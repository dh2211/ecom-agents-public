# Contribution calculation

Required JSON fields: currency, merchandise_revenue_minor, shipping_revenue_minor,
customer_paid_minor, production_cost_minor, supplier_shipping_minor,
other_variable_cost_minor, payment_fixed_minor, payment_rate_bps,
refund_reserve_bps and ad_cost_minor. See the [cost template](examples/costs.example.json).
Minor units avoid floating money rounding: USD 29.99 is 2999. Do not assume every
currency has 2 decimal places; the caller supplies correctly normalized minor units.
100 basis points = 1 percentage point. Use the actual processor fee basis; this
model applies the percentage fee to customer_paid_minor, including collected tax.

Net revenue is after discounts, excluding collected tax. Provider costs include
nonrecoverable tax. Fees and reserve round upward to the next minor unit.
Contribution before ads = net revenue minus production, supplier shipping, other
variable costs, payment fees and reserve. Contribution after ads subtracts ad cost.
Break-even CPA is positive contribution before ads, otherwise zero available spend.
Break-even ROAS is net revenue / positive contribution before ads; otherwise null.
Zero ad spend produces null observed ROAS, never infinity.

The reserve is an explicit planning assumption. Realized-refund analysis needs a
separate reconciled ledger and must not count both full realized cost and the same
reserve. Fixed overhead, income tax and opportunity cost are not modeled. Do not
call this accounting net profit or use mixed-currency/partial-platform totals.
