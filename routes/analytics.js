const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Enforce authentication on all analytics routes
router.use(requireAuth);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verify business membership helper.
 * Uses user-scoped Supabase client where RLS guarantees isolation.
 */
async function verifyBusinessMembership(supabase, businessId) {
  if (!businessId || !UUID_REGEX.test(businessId)) {
    return { authorized: false, error: 'Invalid or missing business ID format.' };
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, currency, industry, location')
    .eq('id', businessId)
    .maybeSingle();

  if (error || !business) {
    return { authorized: false, error: 'Access denied. You do not belong to this business.' };
  }

  return { authorized: true, business };
}

/**
 * Helper to generate an array of YYYY-MM-DD date strings for the last N days (inclusive).
 */
function generateDateRange(days) {
  const dates = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Short label, e.g. "Oct 15"
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    dates.push({ date: dateStr, label });
  }
  return dates;
}

/**
 * GET /api/analytics/dashboard?businessId=...&days=...
 * Business-scoped dashboard analytics aggregation endpoint.
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const { businessId, days } = req.query;

    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    const business = authCheck.business;
    const periodDays = days === '7' ? 7 : 30;

    // 1. Calculate date boundaries (UTC-based)
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
    const startOfTrend = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (periodDays - 1), 0, 0, 0, 0)).toISOString();

    // 2. Execute scoped queries in parallel
    const [
      productsResult,
      monthSalesResult,
      trendSalesResult,
      trendPurchasesResult,
      pendingPurchasesResult,
      recentSalesResult,
      recentPurchasesResult
    ] = await Promise.all([
      // A. Products with stock levels and cost pricing
      req.supabase
        .from('products')
        .select('id, name, sku, category, cost_price, selling_price, current_stock, reorder_level, is_active, unit')
        .eq('business_id', businessId),

      // B. Current calendar month completed sales
      req.supabase
        .from('sales')
        .select('id, total_amount, sale_date, status')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('sale_date', startOfMonth),

      // C. Trend sales in the requested timeframe
      req.supabase
        .from('sales')
        .select('id, total_amount, sale_date, status')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('sale_date', startOfTrend)
        .order('sale_date', { ascending: true }),

      // D. Trend purchases in the requested timeframe (excluding cancelled)
      req.supabase
        .from('purchases')
        .select('id, total_amount, purchase_date, status')
        .eq('business_id', businessId)
        .neq('status', 'cancelled')
        .gte('purchase_date', startOfTrend)
        .order('purchase_date', { ascending: true }),

      // E. Pending / ordered in-flight purchases
      req.supabase
        .from('purchases')
        .select('id, total_amount, status')
        .eq('business_id', businessId)
        .in('status', ['ordered', 'pending']),

      // F. Recent 5 sales
      req.supabase
        .from('sales')
        .select('id, sale_number, customer_name, total_amount, sale_date, status')
        .eq('business_id', businessId)
        .order('sale_date', { ascending: false })
        .limit(5),

      // G. Recent 5 purchases with supplier details
      req.supabase
        .from('purchases')
        .select('id, purchase_number, total_amount, purchase_date, status, suppliers(name)')
        .eq('business_id', businessId)
        .order('purchase_date', { ascending: false })
        .limit(5)
    ]);

    // Handle database query failures safely
    if (productsResult.error) throw new Error(`Products query failed: ${productsResult.error.message}`);
    if (monthSalesResult.error) throw new Error(`Monthly sales query failed: ${monthSalesResult.error.message}`);
    if (trendSalesResult.error) throw new Error(`Trend sales query failed: ${trendSalesResult.error.message}`);
    if (trendPurchasesResult.error) throw new Error(`Trend purchases query failed: ${trendPurchasesResult.error.message}`);
    if (pendingPurchasesResult.error) throw new Error(`Pending purchases query failed: ${pendingPurchasesResult.error.message}`);
    if (recentSalesResult.error) throw new Error(`Recent sales query failed: ${recentSalesResult.error.message}`);
    if (recentPurchasesResult.error) throw new Error(`Recent purchases query failed: ${recentPurchasesResult.error.message}`);

    const rawProducts = productsResult.data || [];
    const monthSales = monthSalesResult.data || [];
    const trendSales = trendSalesResult.data || [];
    const trendPurchases = trendPurchasesResult.data || [];
    const pendingPurchases = pendingPurchasesResult.data || [];
    const recentSales = recentSalesResult.data || [];
    const recentPurchases = recentPurchasesResult.data || [];

    // 3. Compute Product & Inventory Metrics
    let totalProducts = rawProducts.length;
    let activeProductsCount = 0;
    let totalUnitsOnHand = 0;
    let inventoryCostValuation = 0;
    let lowStockProducts = [];
    let outOfStockCount = 0;

    rawProducts.forEach(p => {
      const isActive = p.is_active ?? true;
      if (isActive) {
        activeProductsCount++;
      }

      const stock = Number(p.current_stock || 0);
      const cost = Number(p.cost_price || 0);
      const reorderLevel = Number(p.reorder_level || 0);

      totalUnitsOnHand += stock;
      inventoryCostValuation += stock * cost;

      if (stock === 0) {
        outOfStockCount++;
      }

      if (stock <= reorderLevel) {
        const deficit = Math.max(0, reorderLevel - stock);
        lowStockProducts.push({
          id: p.id,
          name: p.name,
          sku: p.sku || null,
          category: p.category || 'General',
          current_stock: stock,
          reorder_level: reorderLevel,
          stock_deficit: deficit,
          unit: p.unit || 'units',
          cost_price: cost,
          selling_price: Number(p.selling_price || 0),
          stock_status: stock === 0 ? 'out_of_stock' : 'low_stock'
        });
      }
    });

    // Rank critical low-stock items by largest deficit first
    lowStockProducts.sort((a, b) => b.stock_deficit - a.stock_deficit);
    const criticalStock = lowStockProducts.slice(0, 10);

    // 4. Compute Sales Metrics
    let monthlySalesRevenue = 0;
    monthSales.forEach(s => {
      monthlySalesRevenue += Number(s.total_amount || 0);
    });

    let pendingPurchasesSpend = 0;
    pendingPurchases.forEach(p => {
      pendingPurchasesSpend += Number(p.total_amount || 0);
    });

    // 5. Generate Continuous Trend Series (No missing days)
    const dateRange = generateDateRange(periodDays);
    const salesByDate = {};
    const purchasesByDate = {};

    trendSales.forEach(s => {
      const dateKey = s.sale_date ? s.sale_date.slice(0, 10) : '';
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { amount: 0, count: 0 };
      }
      salesByDate[dateKey].amount += Number(s.total_amount || 0);
      salesByDate[dateKey].count += 1;
    });

    trendPurchases.forEach(p => {
      const dateKey = p.purchase_date ? p.purchase_date.slice(0, 10) : '';
      if (!purchasesByDate[dateKey]) {
        purchasesByDate[dateKey] = { amount: 0, count: 0 };
      }
      purchasesByDate[dateKey].amount += Number(p.total_amount || 0);
      purchasesByDate[dateKey].count += 1;
    });

    let totalPeriodSales = 0;
    let totalPeriodPurchases = 0;

    const series = dateRange.map(item => {
      const sData = salesByDate[item.date] || { amount: 0, count: 0 };
      const pData = purchasesByDate[item.date] || { amount: 0, count: 0 };

      const salesAmount = Math.round(sData.amount * 100) / 100;
      const purchasesAmount = Math.round(pData.amount * 100) / 100;

      totalPeriodSales += salesAmount;
      totalPeriodPurchases += purchasesAmount;

      return {
        date: item.date,
        label: item.label,
        sales_amount: salesAmount,
        sales_count: sData.count,
        purchases_amount: purchasesAmount,
        purchases_count: pData.count
      };
    });

    // 6. Build Combined Recent Activity Feed
    const formattedRecentSales = recentSales.map(s => ({
      id: s.id,
      type: 'sale',
      reference_number: s.sale_number,
      party_name: s.customer_name || 'Walk-in Customer',
      amount: Number(s.total_amount || 0),
      status: s.status,
      date: s.sale_date
    }));

    const formattedRecentPurchases = recentPurchases.map(p => ({
      id: p.id,
      type: 'purchase',
      reference_number: p.purchase_number,
      party_name: p.suppliers ? p.suppliers.name : 'No Supplier Attached',
      amount: Number(p.total_amount || 0),
      status: p.status,
      date: p.purchase_date
    }));

    const recentActivity = [...formattedRecentSales, ...formattedRecentPurchases]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);

    // 7. Return predictable structured response
    return res.status(200).json({
      business: {
        id: business.id,
        name: business.name,
        currency: business.currency || 'INR',
        industry: business.industry || null,
        location: business.location || null
      },
      summary: {
        total_products: totalProducts,
        active_products: activeProductsCount,
        total_units_on_hand: totalUnitsOnHand,
        inventory_cost_value: Math.round(inventoryCostValuation * 100) / 100,
        low_stock_count: lowStockProducts.length,
        out_of_stock_count: outOfStockCount,
        monthly_sales_revenue: Math.round(monthlySalesRevenue * 100) / 100,
        monthly_sales_count: monthSales.length,
        pending_purchases_count: pendingPurchases.length,
        pending_purchases_spend: Math.round(pendingPurchasesSpend * 100) / 100
      },
      trend: {
        period_days: periodDays,
        start_date: dateRange[0].date,
        end_date: dateRange[dateRange.length - 1].date,
        total_period_sales: Math.round(totalPeriodSales * 100) / 100,
        total_period_purchases: Math.round(totalPeriodPurchases * 100) / 100,
        series
      },
      critical_stock: criticalStock,
      recent_activity: recentActivity,
      recent_sales: formattedRecentSales,
      recent_purchases: formattedRecentPurchases,
      metadata: {
        generated_at: now.toISOString(),
        calculation_rules: {
          inventory_cost_value: 'Sum of (current_stock * cost_price) for active catalog products. Naturally excludes unreceived purchase orders.',
          low_stock_threshold: 'Products where current_stock <= reorder_level.',
          monthly_sales_revenue: 'Gross completed sales transaction revenue in the current calendar month. Represents gross receipts, not net profit.',
          sales_purchases_trend: `Continuous daily aggregate series for the requested ${periodDays}-day window.`
        }
      }
    });
  } catch (err) {
    console.error('Analytics dashboard error:', err.message);
    return res.status(500).json({
      error: 'Failed to generate dashboard analytics.'
    });
  }
});

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
 * GET /api/analytics/intelligence?businessId=<UUID>&windowDays=30&targetDays=30
 * Product-level inventory intelligence, velocity, stockout risk, and reorder planning.
 */
router.get('/intelligence', async (req, res, next) => {
  try {
    const { businessId, windowDays, targetDays } = req.query;

    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    const business = authCheck.business;

    // Validate windowDays: allowed 14 or 30, default 30
    let parsedWindow = 30;
    if (windowDays !== undefined && windowDays !== null && windowDays !== '') {
      parsedWindow = Number(windowDays);
      if (parsedWindow !== 14 && parsedWindow !== 30) {
        return res.status(400).json({ error: 'Invalid windowDays parameter. Must be 14 or 30.' });
      }
    }

    // Validate targetDays: integer 7 to 90, default 30
    let parsedTarget = 30;
    if (targetDays !== undefined && targetDays !== null && targetDays !== '') {
      parsedTarget = Number(targetDays);
      if (!Number.isInteger(parsedTarget) || parsedTarget < 7 || parsedTarget > 90) {
        return res.status(400).json({ error: 'Invalid targetDays parameter. Must be an integer between 7 and 90.' });
      }
    }

    const now = new Date();
    // 30 days is also used as standard reference for demand trend sample checks
    const maxLookbackDays = Math.max(parsedWindow, 30);
    const sinceDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (maxLookbackDays - 1), 0, 0, 0, 0)).toISOString();
    const windowStartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (parsedWindow - 1), 0, 0, 0, 0)).getTime();
    const trend30StartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0)).getTime();
    const recent14StartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13, 0, 0, 0, 0)).getTime();
    const prior14StartTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 27, 0, 0, 0, 0)).getTime();

    // Fetch active products, sales line items, and pending PO line items in parallel
    const [products, sales, pendingPurchases] = await Promise.all([
      fetchAllActiveProducts(req.supabase, businessId),
      fetchAllSalesInRange(req.supabase, businessId, sinceDate),
      fetchAllPendingPurchases(req.supabase, businessId)
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

    // Evaluate intelligence metrics for each active product
    const recommendations = products.map(p => {
      const stock = Number(p.current_stock || 0);
      const cost = Number(p.cost_price || 0);
      const price = Number(p.selling_price || 0);
      const reorderLevel = Number(p.reorder_level || 0);
      const incoming = Math.round((incomingMap[p.id] || 0) * 100) / 100;
      const effectiveBuffer = Math.round((stock + incoming) * 100) / 100;

      const salesData = productSales[p.id] || {
        windowUnits: 0,
        windowOrderIds: new Set(),
        units30d: 0,
        orderIds30d: new Set(),
        recent14Units: 0,
        prior14Units: 0
      };

      const unitsSoldWindow = Math.round(salesData.windowUnits * 100) / 100;
      const orderCountWindow = salesData.windowOrderIds.size;
      const unitsSold30d = Math.round(salesData.units30d * 100) / 100;
      const orderCount30d = salesData.orderIds30d.size;

      // Catalog age in days (minimum effective denominator of 1 day)
      const createdAt = p.created_at ? new Date(p.created_at) : now;
      const catalogAgeDays = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / 86400000));
      const effectiveDenominator = Math.max(1, Math.min(parsedWindow, catalogAgeDays));

      // Average Daily Sales
      const averageDailySales = Math.round((unitsSoldWindow / effectiveDenominator) * 100) / 100;

      // Days of Stock Remaining (Runway)
      let daysOfStockRemaining = null;
      if (stock <= 0) {
        daysOfStockRemaining = 0;
      } else if (averageDailySales <= 0) {
        daysOfStockRemaining = null;
      } else {
        daysOfStockRemaining = Math.round((stock / averageDailySales) * 10) / 10;
      }

      // Insufficient Sales History Definition:
      // Minimum criteria: at least 2 distinct completed orders AND at least 14 days in the catalog
      const hasSufficientHistory = (orderCountWindow >= 2 && catalogAgeDays >= 14);

      // Deterministic Risk Precedence:
      // 1. CRITICAL_DEPLETED: stock <= 0
      // 2. INSUFFICIENT_DATA: insufficient sales history (unless already depleted)
      // 3. HIGH_RISK: stock > 0 and (runway <= 7 or (stock <= reorder_level and ADS > 0))
      // 4. MODERATE_RISK: (stock <= reorder_level and ADS <= 0) or (runway > 7 and runway <= 14)
      // 5. HEALTHY: stock > reorder_level and (runway > 14 or ADS == 0)
      let riskCategory = 'HEALTHY';
      let riskLabel = 'Adequately Stocked';
      let explanation = '';

      if (stock <= 0) {
        riskCategory = 'CRITICAL_DEPLETED';
        riskLabel = 'Depleted (Out of Stock)';
        explanation = incoming > 0
          ? `Product is completely depleted (0 ${p.unit}). There are ${incoming} units pending in unreceived purchase orders.`
          : `Product is completely depleted (0 ${p.unit}). Immediate replenishment order required.`;
      } else if (!hasSufficientHistory) {
        riskCategory = 'INSUFFICIENT_DATA';
        riskLabel = 'Insufficient Sales History';
        explanation = catalogAgeDays < 14
          ? `Product was added to catalog ${catalogAgeDays} day(s) ago (< 14 days minimum). Demand velocity cannot be estimated reliably.`
          : `Product has only ${orderCountWindow} completed order(s) in this period (< 2 orders minimum). Demand velocity cannot be estimated reliably.`;
        if (stock <= reorderLevel) {
          explanation += ` Stock (${stock}) is below safety threshold (${reorderLevel}); recommendation is based on threshold alone.`;
        }
      } else if (
        (daysOfStockRemaining !== null && daysOfStockRemaining <= 7) ||
        (stock <= reorderLevel && averageDailySales > 0)
      ) {
        riskCategory = 'HIGH_RISK';
        const runwayStr = daysOfStockRemaining !== null ? `${daysOfStockRemaining} days` : 'critical';
        riskLabel = `High Risk (${runwayStr} Runway)`;
        explanation = daysOfStockRemaining !== null && daysOfStockRemaining <= 7
          ? `Estimated stock runway is ${daysOfStockRemaining} days at current velocity of ${averageDailySales} ${p.unit}/day.`
          : `Current stock (${stock}) is at or below minimum threshold (${reorderLevel}) with active daily demand.`;
      } else if (
        (stock <= reorderLevel && averageDailySales <= 0) ||
        (daysOfStockRemaining !== null && daysOfStockRemaining > 7 && daysOfStockRemaining <= 14)
      ) {
        riskCategory = 'MODERATE_RISK';
        riskLabel = daysOfStockRemaining !== null
          ? `Moderate Risk (${daysOfStockRemaining} Days Runway)`
          : 'Moderate Risk (Threshold Breached)';
        explanation = daysOfStockRemaining !== null && daysOfStockRemaining > 7
          ? `Estimated stock runway is ${daysOfStockRemaining} days (1 to 2 weeks). Replenishment should be scheduled.`
          : `Current stock (${stock}) is at or below minimum safety threshold (${reorderLevel}) with low or dormant demand.`;
      } else {
        riskCategory = 'HEALTHY';
        riskLabel = daysOfStockRemaining !== null
          ? `Healthy (${daysOfStockRemaining} Days Runway)`
          : 'Healthy (Stock Above Threshold)';
        explanation = daysOfStockRemaining !== null
          ? `Stock level provides ${daysOfStockRemaining} days of runway above the minimum safety threshold.`
          : `Stock (${stock}) is above minimum threshold (${reorderLevel}) with zero current demand.`;
      }

      // Suggested Reorder Quantity Calculation:
      let targetUnits = 0;
      let suggestedReorderQty = 0;
      let recommendationBasis = 'demand_and_threshold';

      if (!hasSufficientHistory || averageDailySales <= 0) {
        targetUnits = reorderLevel;
        suggestedReorderQty = Math.max(0, Math.ceil(reorderLevel - stock - incoming));
        recommendationBasis = 'threshold_only';
      } else {
        targetUnits = Math.max(reorderLevel, Math.ceil(averageDailySales * parsedTarget));
        suggestedReorderQty = Math.max(0, Math.ceil(targetUnits - stock - incoming));
        recommendationBasis = 'demand_and_threshold';
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

    return res.status(200).json({
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
    });
  } catch (err) {
    console.error('Analytics intelligence error:', err.message);
    return res.status(500).json({
      error: 'Failed to generate inventory intelligence.'
    });
  }
});

const { computeDemandInsights } = require('../services/demandService');

/**
 * GET /api/analytics/demand-insights?businessId=<UUID>&windowDays=30
 * Retrieves period-over-period demand trends, slow-moving stock, and overstock review flags.
 */
router.get('/demand-insights', async (req, res) => {
  try {
    const { businessId, windowDays } = req.query;

    if (!businessId || !UUID_REGEX.test(businessId)) {
      return res.status(403).json({
        error: 'Invalid or missing business ID format.'
      });
    }

    // Verify user belongs to the business
    const authCheck = await verifyBusinessMembership(req.supabase, businessId);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.error });
    }

    // Validate windowDays (allow 14 or 30, default 30)
    let parsedWindow = 30;
    if (windowDays !== undefined && windowDays !== null && windowDays !== '') {
      parsedWindow = parseInt(windowDays, 10);
      if (![14, 30].includes(parsedWindow)) {
        return res.status(400).json({
          error: 'Invalid windowDays parameter. Allowed values are 14 or 30.'
        });
      }
    }

    const insights = await computeDemandInsights(req.supabase, authCheck.business, parsedWindow);

    return res.status(200).json(insights);
  } catch (err) {
    console.error('Analytics demand insights error:', err.message);
    return res.status(500).json({
      error: 'Failed to generate demand insights.'
    });
  }
});

module.exports = router;
