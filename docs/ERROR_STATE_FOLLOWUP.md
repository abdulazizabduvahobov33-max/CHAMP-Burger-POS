# Error-state UI follow-up

Written during the DATABASE / INDEX / QUERY PERFORMANCE audit as a byproduct of re-checking
every `isError` call site left over from the ERROR HANDLING / RESILIENCE audit. Not touched in
that pass or this one — this is a plain inventory for a future, separate UI-cleanup task.

Two genuinely different situations got lumped together as "isError places" before; splitting
them here:

- **Query-load errors** — a whole screen/table failed to fetch. The two real bugs found and
  fixed in the resilience audit (PosMenu, PendingOrdersPanel) were in this category: the failure
  read as a false empty state, not just a missing retry button. Everything below in this category
  already shows a real (if plain) error message — the gap is just no `ErrorState`/retry action,
  a UX polish item, not a correctness bug.
- **Mutation-submit errors** — a form's save/create failed. These already show an inline message
  in the dialog and the user can just resubmit without navigating anywhere — a different,
  already-reasonable pattern that doesn't need the same `ErrorState` component.

## Query-load errors (candidates for `ErrorState` + retry)

| Screen / component | Current behavior | Severity | Worth changing? |
|---|---|---|---|
| `widgets/sales-table/SalesTable.tsx` | Plain error text, no retry button | Low | Yes — admin reports page, worth the polish |
| `widgets/purchases-table/PurchasesTable.tsx` | Plain error text, no retry button | Low | Yes |
| `widgets/products-table/ProductsTable.tsx` | Plain error text, no retry button | Low | Yes |
| `widgets/users-table/UsersTable.tsx` | Plain error text, no retry button | Low | Yes |
| `widgets/warehouse-table/WarehouseTable.tsx` | Plain error text, no retry button | Low | Yes |
| `widgets/top-products/TopProductsList.tsx` | Plain error text, no retry button | Low | Yes |
| `widgets/product-profitability/ProductProfitabilityTable.tsx` | Plain error text, no retry button | Low | Yes |
| `widgets/ingredient-analytics/IngredientAnalyticsTable.tsx` | Plain error text, no retry button | Low | Yes |
| `widgets/low-stock/LowStockList.tsx` | Plain error text, no retry button (small dashboard widget) | Low | Optional — low visual weight, low urgency |
| `pages/SettingsPage.tsx` (`useSettings`) | Plain error text, no retry button | Low | Yes |
| `pages/SettingsPage.tsx` (`useSystemInfo`) | Plain error text, no retry button | Low | Optional — diagnostic-only panel |

None of these were found to have the "false empty state" bug — they all correctly show *some*
error, just without a retry affordance. Fixing all ~10 is a single, low-risk, mechanical pass:
swap the `<p role="alert">{message}</p>` for `<ErrorState message={...} onRetry={() => void
refetch()} />`, same as the 5 already done (`DashboardStats`, `ProfitPage`, `StockIntakeGrid`,
`PosMenu`, `PendingOrdersPanel`).

## Mutation-submit errors (different pattern, likely fine as-is)

`features/auth/LoginPage.tsx`, `features/auth/OwnerLoginPage.tsx`,
`features/change-password/ChangePasswordButton.tsx`,
`features/ingredient-form/IngredientFormDialog.tsx`,
`features/product-form/ProductFormDialog.tsx`,
`features/purchase-create/PurchaseCreateDialog.tsx`,
`features/recipe-manage/RecipeDialog.tsx`,
`features/stock-restock/RestockDialog.tsx`,
`features/stock-writeoff/WriteOffDialog.tsx`,
`features/user-manage/UserFormDialog.tsx`,
`features/user-manage/UserPasswordDialog.tsx`.

All show `mutation.isError` inline inside their own dialog with a real (already
`getErrorMessage`-mapped) message, and the dialog stays open so the user can just fix the input
and resubmit — no navigation, no false state. Not a correctness gap. Leave as-is unless a future
pass wants purely cosmetic consistency with `ErrorState`'s styling.
