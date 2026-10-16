/**
 * Services: Inventory Intelligence & Replenishment Planning Engine
 * Computes deterministic burn rates, stockout runways, safety thresholds, and incoming PO offsets.
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
 */
async function fetchAllSalesInRange(supabase, businessId, sinceDate) {
  let allSales = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('sales')
      .select('id, sale_date, status, sale_items(product_id, quantity)')
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
 * Helper to fetch all in-flight pending/ordered purchases with line items with pagination safety.
 */
async function fetchAllPendingPurchases(supabase, businessId) {
  let allPurchases = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('purchases')
      .select('id, purchase_number, status, purchase_items(product_id, quantity)')
      .eq('business_id', businessId)
      .in('status', ['ordered', 'pending'])
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Pending purchases retrieval failed: ${error.message}`);
    if (data && data.length > 0) {
      allPurchases = allPurchases.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  return allPurchases;
}

/**
 * Pure calculation logic for Inventory Intelligence.
 * Usable by both GET /api/analytics/intelligence and POST /api/ai/inventory-insights.
 */
async function computeInventoryIntelligence(supabase, business, parsedWindow = 30, parsedTarget = 30) {
  const businessId = business.id;
  const now = new Date();
  const maxLookbackDays = Math.max(parsedWindow, 30);
  const sinceDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (maxLookbackDays - 1), 0, 0, 0, 0)).toISOString();
  const windowStartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (parsedWindow - 1), 0, 0, 0, 0)).getTime();
  const trend30StartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0)).getTime();
  const recent14StartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13, 0, 0, 0, 0)).getTime();
  const prior14StartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 27, 0, 0, 0, 0)).getTime();

  // Fetch active products, sales line items, and pending PO line items in parallel
  const [products, sales, pendingPurchases] = await Promise.all([
    fetchAllActiveProducts(supabase, businessId),
    fetchAllSalesInRange(supabase, businessId, sinceDate),
    fetchAllPendingPurchases(supabase, businessId)
  ]);

  // Aggregate incoming quantities per product from ordered/pending purchases only
  const incomingMap = {};
  pendingPurchases.forEach(purchase => {
    const items = Array.isArray(purchase.purchase_items) ? purchase.purchase_items : [];
    items.forEach(item => {
      const pId = item.product_id;
      const qty = Number(item.quantity || 0);
      incomingMap[pId] = (incomingMap[pId] || 0) + qty;
    });
  });

  // Aggregate sales per product
  const productSales = {};
  sales.forEach(sale => {
    const saleTime = new Date(sale.sale_date).getTime();
    const inWindow = saleTime >= windowStartTime;
    const in30d = saleTime >= trend30StartTime;
    const inRecent14 = saleTime >= recent14StartTime;
    const inPrior14 = saleTime >= prior14StartTime && saleTime < recent14StartTime;

    const items = Array.isArray(sale.sale_items) ? sale.sale_items : [];
    items.forEach(item => {
      const pId = item.product_id;
      if (!productSales[pId]) {
        productSales[pId] = {
          windowUnits: 0,
          windowOrderIds: new Set(),
          units30d: 0,
          orderIds30d: new Set(),
          recent14Units: 0,
          prior14Units: 0
        };
      }

      const qty = Number(item.quantity || 0);
      if (inWindow) {
        productSales[pId].windowUnits += qty;
        productSales[pId].windowOrderIds.add(sale.id);
      }
      if (in30d) {
        productSales[pId].units30d += qty;
        productSales[pId].orderIds30d.add(sale.id);
      }
      if (inRecent14) {
        productSales[pId].recent14Units += qty;
      }
      if (inPrior14) {
        productSales[pId].prior14Units += qty;
      }
    });
  });

  // Calculate product-level metrics and recommendations
  const recommendations = products.map(p => {
    const stock = Number(p.current_stock || 0);
    const reorderLevel = Number(p.reorder_level || 0);
    const cost = Number(p.cost_price || 0);
    const price = Number(p.selling_price || 0);
    const incoming = incomingMap[p.id] || 0;
    const effectiveBuffer = stock + incoming;

    // Catalog age
    const createdAt = p.created_at ? new Date(p.created_at).getTime() : now.getTime();
    const ageDaysExact = Math.max(0, (now.getTime() - createdAt) / (1000 * 60 * 60 * 24));
    const catalogAgeDays = Math.max(1, Math.round(ageDaysExact));

    const salesData = productSales[p.id] || {
      windowUnits: 0,
      windowOrderIds: new Set(),
      units30d: 0,
      orderIds30d: new Set(),
      recent14Units: 0,
      prior14Units: 0
    };

    const unitsSoldWindow = salesData.windowUnits;
    const orderCountWindow = salesData.windowOrderIds.size;
    const unitsSold30d = salesData.units30d;
    const orderCount30d = salesData.orderIds30d.size;

    // Effective Denominator for ADS
    const effectiveDenominator = Math.max(1, Math.min(parsedWindow, catalogAgeDays));
    const rawADS = unitsSoldWindow / effectiveDenominator;
    const averageDailySales = Math.round(rawADS * 100) / 100;

    // Days of stock remaining (Runway)
    let daysOfStockRemaining = null;
    if (stock <= 0) {
      daysOfStockRemaining = 0.0;
    } else if (averageDailySales > 0) {
      daysOfStockRemaining = Math.round((stock / averageDailySales) * 10) / 10;
    }

    // History sufficiency criteria: >= 14 days catalog age AND >= 2 distinct completed orders
    const hasSufficientHistory = catalogAgeDays >= 14 && orderCount30d >= 2;

    // Risk Classification & Replenishment Planning
    let riskCategory = 'HEALTHY';
    let riskLabel = 'Adequate';
    let targetUnits = 0;
    let suggestedReorderQty = 0;
    let recommendationBasis = 'burn_rate_and_threshold';
    let explanation = '';

    // Rule 1: CRITICAL DEPLETED (Stock <= 0) ALWAYS takes precedence
    if (stock <= 0) {
      riskCategory = 'CRITICAL_DEPLETED';
      riskLabel = 'Stock Exhausted';
      if (hasSufficientHistory && averageDailySales > 0) {
        targetUnits = Math.ceil(averageDailySales * parsedTarget);
        const desiredTotal = Math.max(targetUnits, reorderLevel);
        suggestedReorderQty = Math.max(0, desiredTotal - incoming);
        recommendationBasis = 'burn_rate_and_threshold';
        explanation = `Stock is fully exhausted. Average burn rate is ${averageDailySales} units/day. Reorder suggested to achieve ${parsedTarget} days coverage plus safety stock threshold (${reorderLevel} units), accounting for ${incoming} units already on purchase order.`;
      } else {
        suggestedReorderQty = Math.max(0, reorderLevel - incoming);
        recommendationBasis = 'threshold_only';
        explanation = `Stock is exhausted. Due to insufficient historical sales data (<14 days in catalog or <2 orders), replenishment is calibrated strictly to restore the safety reorder threshold of ${reorderLevel} units.`;
      }
    } else if (!hasSufficientHistory) {
      // Rule 2: INSUFFICIENT HISTORY (New items or < 2 orders with positive stock)
      riskCategory = 'INSUFFICIENT_DATA';
      riskLabel = 'Calibrating';
      recommendationBasis = 'threshold_only';
      if (effectiveBuffer < reorderLevel) {
        suggestedReorderQty = reorderLevel - effectiveBuffer;
        explanation = `Calibrating item (<14 days or <2 orders). Available stock (${effectiveBuffer}) is below minimum threshold (${reorderLevel}). Replenishment suggested to maintain baseline buffer.`;
      } else {
        suggestedReorderQty = 0;
        explanation = `Insufficient sales history to model daily velocity accurately (${catalogAgeDays} days in catalog, ${orderCount30d} orders). Current stock meets safety threshold.`;
      }
    } else {
      // Rule 3: SUFFICIENT HISTORY with POSITIVE STOCK
      targetUnits = Math.ceil(averageDailySales * parsedTarget);
      const desiredTotal = Math.max(targetUnits, reorderLevel);
      suggestedReorderQty = Math.max(0, desiredTotal - effectiveBuffer);

      if (daysOfStockRemaining !== null && daysOfStockRemaining <= 7) {
        riskCategory = 'HIGH_RISK';
        riskLabel = 'High Stockout Risk';
        explanation = `Current stock covers only ${daysOfStockRemaining} days based on daily velocity of ${averageDailySales} units/day. Urgent restock suggested to avoid total depletion.`;
      } else if (daysOfStockRemaining !== null && daysOfStockRemaining <= 14) {
        riskCategory = 'MODERATE_RISK';
        riskLabel = 'Moderate Risk';
        explanation = `Current runway is ${daysOfStockRemaining} days. Replenishment recommended to maintain healthy target coverage of ${parsedTarget} days.`;
      } else if (effectiveBuffer < reorderLevel) {
        riskCategory = 'HIGH_RISK';
        riskLabel = 'Below Minimum Threshold';
        explanation = `Available stock (${effectiveBuffer}) is below safety threshold (${reorderLevel}), despite current burn rate runway. Restock suggested to restore buffer.`;
      } else {
        riskCategory = 'HEALTHY';
        riskLabel = 'Healthy Runway';
        if (suggestedReorderQty > 0) {
          explanation = `Stock level is currently healthy (${daysOfStockRemaining} days runway), but replenishment of ${suggestedReorderQty} units is recommended to maintain the ${parsedTarget}-day coverage target.`;
        } else {
          explanation = `Stock level is healthy with ${daysOfStockRemaining !== null ? daysOfStockRemaining + ' days runway' : 'stable coverage'}. No immediate purchase orders required.`;
        }
      }
    }

    const estimatedReorderCost = Math.round(suggestedReorderQty * cost * 100) / 100;

    // Demand Trend Classification:
    // Minimum requirement: >= 6 units sold across >= 3 distinct orders in the last 30 days
    let demandTrend = 'INSUFFICIENT_VOLUME';
    let velocityRatio = null;

    const meetsSampleReq = (unitsSold30d >= 6 && orderCount30d >= 3);
    if (meetsSampleReq) {
      const recentVelocity = salesData.recent14Units / 14;
      const priorVelocity = salesData.prior14Units / 14;

      if (priorVelocity === 0) {
        velocityRatio = recentVelocity > 0 ? 99.0 : 1.0;
        demandTrend = recentVelocity > 0 ? 'ACCELERATING' : 'STEADY';
      } else {
        velocityRatio = Math.round((recentVelocity / priorVelocity) * 100) / 100;
        if (velocityRatio >= 1.60) {
          demandTrend = 'ACCELERATING';
        } else if (velocityRatio <= 0.50) {
          demandTrend = 'DECELERATING';
        } else {
          demandTrend = 'STEADY';
        }
      }
    }

    return {
      product_id: p.id,
      name: p.name,
      sku: p.sku || null,
      category: p.category || 'General',
      unit: p.unit || 'units',
      supplier: p.suppliers ? { id: p.suppliers.id, name: p.suppliers.name } : null,
      cost_price: cost,
      purchase_price: cost,
      unit_cost: cost,
      selling_price: price,
      current_stock: stock,
      reorder_level: reorderLevel,
      minimum_stock: reorderLevel,
      incoming_stock: incoming,
      effective_available_stock: effectiveBuffer,
      metrics: {
        units_sold_window: unitsSoldWindow,
        orders_count_window: orderCountWindow,
        catalog_age_days: catalogAgeDays,
        effective_denominator_days: effectiveDenominator,
        average_daily_sales: averageDailySales,
        days_of_stock_remaining: daysOfStockRemaining,
        has_sufficient_history: hasSufficientHistory,
        demand_trend: demandTrend,
        velocity_ratio: velocityRatio
      },
      intelligence: {
        risk_category: riskCategory,
        risk_label: riskLabel,
        target_units: targetUnits,
        suggested_reorder_qty: suggestedReorderQty,
        estimated_reorder_cost: estimatedReorderCost,
        recommendation_basis: recommendationBasis,
        explanation
      }
    };
  });

  // Deterministic Sorting:
  // 1. CRITICAL_DEPLETED, 2. HIGH_RISK, 3. MODERATE_RISK, 4. HEALTHY, 5. INSUFFICIENT_DATA
  const categoryRank = {
    CRITICAL_DEPLETED: 1,
    HIGH_RISK: 2,
    MODERATE_RISK: 3,
    HEALTHY: 4,
    INSUFFICIENT_DATA: 5
  };

  recommendations.sort((a, b) => {
    const rankDiff = categoryRank[a.intelligence.risk_category] - categoryRank[b.intelligence.risk_category];
    if (rankDiff !== 0) return rankDiff;

    // Tie breaker 1: Runway ascending (least runway first, nulls treated as high runway)
    const aRunway = a.metrics.days_of_stock_remaining !== null ? a.metrics.days_of_stock_remaining : 999999;
    const bRunway = b.metrics.days_of_stock_remaining !== null ? b.metrics.days_of_stock_remaining : 999999;
    if (aRunway !== bRunway) return aRunway - bRunway;

    // Tie breaker 2: Suggested reorder quantity descending
    if (b.intelligence.suggested_reorder_qty !== a.intelligence.suggested_reorder_qty) {
      return b.intelligence.suggested_reorder_qty - a.intelligence.suggested_reorder_qty;
    }

    // Tie breaker 3: Alphabetical by name
    return a.name.localeCompare(b.name);
  });

  const summary = {
    total_evaluated_products: recommendations.length,
    critical_depleted_count: recommendations.filter(r => r.intelligence.risk_category === 'CRITICAL_DEPLETED').length,
    high_risk_count: recommendations.filter(r => r.intelligence.risk_category === 'HIGH_RISK').length,
    moderate_risk_count: recommendations.filter(r => r.intelligence.risk_category === 'MODERATE_RISK').length,
    healthy_count: recommendations.filter(r => r.intelligence.risk_category === 'HEALTHY').length,
    insufficient_data_count: recommendations.filter(r => r.intelligence.risk_category === 'INSUFFICIENT_DATA').length,
    total_suggested_reorder_units: recommendations.reduce((acc, r) => acc + r.intelligence.suggested_reorder_qty, 0),
    total_estimated_reorder_cost: Math.round(recommendations.reduce((acc, r) => acc + r.intelligence.estimated_reorder_cost, 0) * 100) / 100
  };

  return {
    business_id: business.id,
    currency: business.currency || 'INR',
    business: {
      id: business.id,
      name: business.name,
      currency: business.currency || 'INR',
      industry: business.industry || null,
      location: business.location || null
    },
    parameters: {
      window_days: parsedWindow,
      target_days: parsedTarget
    },
    summary,
    recommendations,
    metadata: {
      generated_at: now.toISOString(),
      calculation_rules: {
        average_daily_sales: 'Units sold in completed sales within the window divided by the shorter of window days and catalog age (minimum 1 day).',
        days_of_stock_remaining: 'Current stock divided by average daily sales. Null when daily sales velocity is zero. Zero when current stock <= 0.',
        incoming_stock: 'Sum of line item quantities in purchase orders with status ordered or pending. Excludes received and cancelled orders.',
        effective_available_stock: 'On-hand stock plus incoming purchase orders.',
        suggested_reorder_qty: 'Replenishment required to reach target coverage days while maintaining safety stock threshold, offset by effective available stock.',
        insufficient_history: 'Products with fewer than 2 distinct completed sales orders or less than 14 days in catalog. Recommendations fall back to threshold alone.'
      }
    }
  };
}

module.exports = {
  computeInventoryIntelligence,
  fetchAllActiveProducts,
  fetchAllSalesInRange,
  fetchAllPendingPurchases
};
