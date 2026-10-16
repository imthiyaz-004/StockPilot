/**
 * StockPilot Stage 7.3: Demand Insights & Slow-Moving Stock Calculation Engine
 *
 * Computes deterministic demand trends (period-over-period comparison),
 * slow-moving stock identification, and heuristic overstock review flags.
 * Operates strictly on verified completed sales transactions.
 */

/**
 * Helper to fetch all active products for a business with pagination safety.
 */
async function fetchAllActiveProducts(supabase, businessId) {
  let allProducts = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, category, unit, cost_price, selling_price, current_stock, reorder_level, is_active, created_at, supplier_id, suppliers(id, name)')
      .eq('business_id', businessId)
      .or('is_active.eq.true,is_active.is.null')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Products retrieval failed: ${error.message}`);
    if (data && data.length > 0) {
      const activeProducts = data.filter(p => p.is_active !== false);
      allProducts = allProducts.concat(activeProducts);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allProducts;
}

/**
 * Helper to fetch all completed sales with line items in date range with pagination safety.
 * Excludes draft, pending, cancelled, and refunded sales.
 */
async function fetchAllCompletedSalesInRange(supabase, businessId, sinceDate) {
  let allSales = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('sales')
      .select('id, sale_date, status, sale_items(product_id, quantity, unit_price)')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', sinceDate)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Sales retrieval failed: ${error.message}`);
    if (data && data.length > 0) {
      allSales = allSales.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allSales;
}

/**
 * Pure calculation logic for Demand Insights and Slow-Moving Inventory.
 *
 * @param {object} supabase - Authenticated Supabase client
 * @param {object} business - Business entity { id, name, currency }
 * @param {number} windowDays - Recent evaluation window (14 or 30 days)
 */
async function computeDemandInsights(supabase, business, windowDays = 30) {
  const businessId = business.id;
  const parsedWindow = (Number(windowDays) === 14) ? 14 : 30;

  const now = new Date();

  // Define strict UTC boundary timestamps:
  // Recent Period: [recentStartTime, now] (Length: parsedWindow days)
  // Preceding Period: [precedingStartTime, recentStartTime) (Length: parsedWindow days)
  const recentStartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (parsedWindow - 1), 0, 0, 0, 0));
  const precedingStartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (2 * parsedWindow - 1), 0, 0, 0, 0));

  const recentStartMs = recentStartTime.getTime();
  const precedingStartMs = precedingStartTime.getTime();
  const querySinceDate = precedingStartTime.toISOString();

  // Fetch active products and completed sales across both periods in parallel
  const [products, sales] = await Promise.all([
    fetchAllActiveProducts(supabase, businessId),
    fetchAllCompletedSalesInRange(supabase, businessId, querySinceDate)
  ]);

  // Aggregate product sales separately for Recent and Preceding windows
  const productMetrics = {};

  sales.forEach(sale => {
    const saleDate = new Date(sale.sale_date);
    const saleTime = saleDate.getTime();

    const isRecent = saleTime >= recentStartMs;
    const isPreceding = saleTime >= precedingStartMs && saleTime < recentStartMs;

    if (!isRecent && !isPreceding) return;

    const items = Array.isArray(sale.sale_items) ? sale.sale_items : [];
    items.forEach(item => {
      const pId = item.product_id;
      if (!pId) return;

      if (!productMetrics[pId]) {
        productMetrics[pId] = {
          recentUnits: 0,
          recentOrders: new Set(),
          recentRevenue: 0,
          precedingUnits: 0,
          precedingOrders: new Set(),
          precedingRevenue: 0,
          latestSaleDate: null
        };
      }

      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);

      // Track latest completed sale date
      if (!productMetrics[pId].latestSaleDate || saleDate > productMetrics[pId].latestSaleDate) {
        productMetrics[pId].latestSaleDate = saleDate;
      }

      if (isRecent) {
        productMetrics[pId].recentUnits += qty;
        productMetrics[pId].recentOrders.add(sale.id);
        productMetrics[pId].recentRevenue += qty * price;
      } else if (isPreceding) {
        productMetrics[pId].precedingUnits += qty;
        productMetrics[pId].precedingOrders.add(sale.id);
        productMetrics[pId].precedingRevenue += qty * price;
      }
    });
  });

  // Summary counts
  let acceleratingCount = 0;
  let deceleratingCount = 0;
  let steadyCount = 0;
  let unclassifiedTrendCount = 0;
  let slowMovingCount = 0;
  let stagnantCount = 0;
  let overstockedCount = 0;
  let totalExcessCapitalUnderReview = 0;
  let calibratingCount = 0;

  // Process each product
  const items = products.map(p => {
    const stock = Number(p.current_stock || 0);
    const reorderLevel = Number(p.reorder_level || 0);
    const cost = Number(p.cost_price || 0);
    const price = Number(p.selling_price || 0);

    // Catalog age
    const createdAt = p.created_at ? new Date(p.created_at) : now;
    const catalogAgeDays = Math.max(1, Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));

    const salesData = productMetrics[p.id] || {
      recentUnits: 0,
      recentOrders: new Set(),
      recentRevenue: 0,
      precedingUnits: 0,
      precedingOrders: new Set(),
      precedingRevenue: 0,
      latestSaleDate: null
    };

    const recentUnits = Math.round(salesData.recentUnits * 100) / 100;
    const precedingUnits = Math.round(salesData.precedingUnits * 100) / 100;
    const recentOrdersCount = salesData.recentOrders.size;
    const precedingOrdersCount = salesData.precedingOrders.size;
    const totalOrdersBoth = recentOrdersCount + precedingOrdersCount;
    const totalUnitsBoth = recentUnits + precedingUnits;

    // 1. Demand Velocity (Average Daily Sales in Recent Period)
    const averageDailySales = Math.round((recentUnits / parsedWindow) * 100) / 100;

    // Turnover Days (Stock / ADS)
    let turnoverDays = null;
    if (stock <= 0) {
      turnoverDays = 0;
    } else if (averageDailySales > 0) {
      turnoverDays = Math.round((stock / averageDailySales) * 10) / 10;
    }

    // 2. Period-over-Period Demand Trend
    const unitsChange = Math.round((recentUnits - precedingUnits) * 100) / 100;
    let percentageChange = null;
    let percentageChangeLabel = '';

    if (precedingUnits > 0) {
      percentageChange = Math.round(((recentUnits - precedingUnits) / precedingUnits) * 1000) / 10;
      percentageChangeLabel = `${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(1)}%`;
    } else if (recentUnits > 0) {
      // Zero sales in earlier period, positive sales now: avoid division by zero or fake percentages
      percentageChange = null;
      percentageChangeLabel = `New Volume (0 → ${recentUnits})`;
    } else {
      percentageChange = 0.0;
      percentageChangeLabel = 'No Activity (0 → 0)';
    }

    // Trend Classification
    // Requires catalog age >= parsedWindow days AND at least 2 orders or 4 units to classify confidently
    const hasSufficientTrendObservations = catalogAgeDays >= parsedWindow && (totalOrdersBoth >= 2 || totalUnitsBoth >= 4);

    let demandTrend = 'UNCLASSIFIED';
    let demandTrendLabel = 'Insufficient Data';
    let trendBadgeClass = 'calibrating';

    if (!hasSufficientTrendObservations) {
      demandTrend = 'UNCLASSIFIED';
      demandTrendLabel = catalogAgeDays < parsedWindow
        ? `Calibrating (< ${parsedWindow}d in catalog)`
        : 'Low Observation Volume';
      trendBadgeClass = 'calibrating';
      unclassifiedTrendCount++;
    } else {
      if (percentageChange !== null) {
        if (percentageChange >= 25.0) {
          demandTrend = 'ACCELERATING';
          demandTrendLabel = `Accelerating (${percentageChangeLabel})`;
          trendBadgeClass = 'accelerating';
          acceleratingCount++;
        } else if (percentageChange <= -25.0) {
          demandTrend = 'DECELERATING';
          demandTrendLabel = `Decelerating (${percentageChangeLabel})`;
          trendBadgeClass = 'decelerating';
          deceleratingCount++;
        } else {
          demandTrend = 'STEADY';
          demandTrendLabel = 'Steady Demand';
          trendBadgeClass = 'steady';
          steadyCount++;
        }
      } else if (precedingUnits === 0 && recentUnits >= 4) {
        demandTrend = 'ACCELERATING';
        demandTrendLabel = `Accelerating (${percentageChangeLabel})`;
        trendBadgeClass = 'accelerating';
        acceleratingCount++;
      } else {
        demandTrend = 'STEADY';
        demandTrendLabel = 'Steady Demand';
        trendBadgeClass = 'steady';
        steadyCount++;
      }
    }

    // 3. Slow-Moving Stock Evaluation
    let velocityStatus = 'ACTIVE';
    let velocityLabel = 'Active Turnover';
    let isSlowMoving = false;

    if (catalogAgeDays < 30) {
      velocityStatus = 'CALIBRATING';
      velocityLabel = 'Newly Listed (< 30d in catalog)';
      isSlowMoving = false;
      calibratingCount++;
    } else if (stock <= 0) {
      velocityStatus = 'DEPLETED';
      velocityLabel = 'Out of Stock';
      isSlowMoving = false;
    } else if (recentUnits === 0) {
      velocityStatus = 'STAGNANT';
      velocityLabel = `Stagnant (0 units sold in ${parsedWindow}d)`;
      isSlowMoving = true;
      stagnantCount++;
      slowMovingCount++;
    } else if (turnoverDays !== null && turnoverDays > 90) {
      velocityStatus = 'SLOW_MOVING';
      velocityLabel = `Slow Turnover (${turnoverDays}d of stock on hand)`;
      isSlowMoving = true;
      slowMovingCount++;
    } else {
      velocityStatus = 'ACTIVE';
      velocityLabel = `Normal Turnover (${turnoverDays !== null ? turnoverDays + 'd' : 'adequate'})`;
      isSlowMoving = false;
    }

    // 4. Possible Overstock Evaluation
    // Heuristic target: reorder_level + (ADS * parsedWindow)
    const targetCoverageUnits = Math.ceil(averageDailySales * parsedWindow);
    const normalOperatingMax = Math.max(reorderLevel, targetCoverageUnits);

    let isOverstock = false;
    let excessUnits = 0;
    let overstockSeverity = 'NONE';
    let overstockEvidence = '';

    if (catalogAgeDays >= 30 && stock > 0) {
      if (recentUnits === 0 && stock > reorderLevel && stock >= 5) {
        isOverstock = true;
        excessUnits = stock - reorderLevel;
        overstockSeverity = stock >= (reorderLevel * 2) ? 'HIGH' : 'MODERATE';
        overstockEvidence = `Zero completed sales observed in the past ${parsedWindow} days while holding ${stock} units on-hand. Exceeds minimum safety stock (${reorderLevel} units) by ${excessUnits} units.`;
      } else if (averageDailySales > 0 && stock > (normalOperatingMax * 1.8) && (stock - normalOperatingMax) >= 5) {
        isOverstock = true;
        excessUnits = stock - normalOperatingMax;
        overstockSeverity = (turnoverDays && turnoverDays > 120) ? 'HIGH' : 'MODERATE';
        overstockEvidence = `On-hand stock (${stock} units) represents ${turnoverDays} days of coverage at current daily sales (${averageDailySales}/day). Exceeds the standard ${parsedWindow}-day operational target (${normalOperatingMax} units) by ${excessUnits} units.`;
      }
    }

    let potentialExcessCapital = 0;
    if (isOverstock) {
      potentialExcessCapital = Math.round(excessUnits * cost * 100) / 100;
      overstockedCount++;
      totalExcessCapitalUnderReview += potentialExcessCapital;
    }

    return {
      product_id: p.id,
      name: p.name,
      sku: p.sku || null,
      category: p.category || 'General',
      unit: p.unit || 'units',
      supplier: p.suppliers ? { id: p.suppliers.id, name: p.suppliers.name } : null,
      cost_price: cost,
      selling_price: price,
      current_stock: stock,
      reorder_level: reorderLevel,
      catalog_age_days: catalogAgeDays,
      last_sale_date: salesData.latestSaleDate ? salesData.latestSaleDate.toISOString().slice(0, 10) : null,
      demand_metrics: {
        window_days: parsedWindow,
        recent_units_sold: recentUnits,
        recent_orders_count: recentOrdersCount,
        preceding_units_sold: precedingUnits,
        preceding_orders_count: precedingOrdersCount,
        units_change: unitsChange,
        percentage_change: percentageChange,
        percentage_change_label: percentageChangeLabel,
        average_daily_sales: averageDailySales,
        turnover_days: turnoverDays,
        demand_trend: demandTrend,
        demand_trend_label: demandTrendLabel,
        trend_badge_class: trendBadgeClass
      },
      velocity_metrics: {
        velocity_status: velocityStatus,
        velocity_label: velocityLabel,
        is_slow_moving: isSlowMoving
      },
      overstock_metrics: {
        is_overstock: isOverstock,
        excess_units: excessUnits,
        overstock_severity: overstockSeverity,
        potential_excess_capital: potentialExcessCapital,
        evidence: isOverstock ? overstockEvidence : 'Inventory is within normal operational coverage targets.'
      }
    };
  });

  // Sort items: Put items needing attention first (overstocked or stagnant, then accelerating)
  items.sort((a, b) => {
    // Overstock priority
    if (a.overstock_metrics.is_overstock && !b.overstock_metrics.is_overstock) return -1;
    if (!a.overstock_metrics.is_overstock && b.overstock_metrics.is_overstock) return 1;

    // Slow moving priority
    if (a.velocity_metrics.is_slow_moving && !b.velocity_metrics.is_slow_moving) return -1;
    if (!a.velocity_metrics.is_slow_moving && b.velocity_metrics.is_slow_moving) return 1;

    // Largest units sold descending
    return b.demand_metrics.recent_units_sold - a.demand_metrics.recent_units_sold;
  });

  const periodContext = {
    window_days: parsedWindow,
    recent_period: {
      label: `Recent ${parsedWindow} Days`,
      start_date: recentStartTime.toISOString().slice(0, 10),
      end_date: now.toISOString().slice(0, 10)
    },
    preceding_period: {
      label: `Preceding ${parsedWindow} Days`,
      start_date: precedingStartTime.toISOString().slice(0, 10),
      end_date: recentStartTime.toISOString().slice(0, 10)
    }
  };

  return {
    business: {
      id: business.id,
      name: business.name,
      currency: business.currency || 'INR'
    },
    period_context: periodContext,
    summary: {
      total_active_products: products.length,
      accelerating_count: acceleratingCount,
      decelerating_count: deceleratingCount,
      steady_count: steadyCount,
      unclassified_trend_count: unclassifiedTrendCount,
      slow_moving_count: slowMovingCount,
      stagnant_count: stagnantCount,
      overstocked_count: overstockedCount,
      total_excess_capital_under_review: Math.round(totalExcessCapitalUnderReview * 100) / 100,
      calibrating_count: calibratingCount
    },
    items,
    metadata: {
      generated_at: now.toISOString(),
      disclaimers: {
        overstock: 'Possible overstock flags are heuristic suggestions for inventory review based on historical velocity and safety stock thresholds. They do not constitute financial forecasts, definitive inventory write-downs, or recoverable cash projections. Recoverable capital depends on market liquidity, supplier return terms, and holding costs.',
        periods: `Recent period covers ${periodContext.recent_period.start_date} to ${periodContext.recent_period.end_date} (${parsedWindow} days). Preceding period covers equivalent ${periodContext.preceding_period.start_date} to ${periodContext.preceding_period.end_date} (${parsedWindow} days). Sales data reflects completed customer orders only.`,
        calibrating: 'Items listed in the catalog for fewer than 30 days are classified as calibrating to prevent misleading low-turnover alarms before baseline demand can be established.'
      }
    }
  };
}

module.exports = {
  fetchAllActiveProducts,
  fetchAllCompletedSalesInRange,
  computeDemandInsights
};
