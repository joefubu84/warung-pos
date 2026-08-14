# Plan: Remove Global Fulfillment Selectors

The goal is to remove the global "Order Type" (Dine-in/Takeaway/Delivery) selectors from the staff ordering page (`/orders`) and the customer QR page (`/t/$token`), since fulfillment is now handled per-item.

## Proposed Changes

### 1. `src/routes/orders.tsx` (Staff Side)

- Remove the `editOrderType` and `editDeliveryFee` state variables and their usage.
- Update `handleSubmitOrder` to determine the overall order `type` based on whether any item in the cart is `dine_in`.
- Update the Edit Order dialog to remove the global fulfillment radio buttons.
- Update the order total calculation to use per-item container charges instead of a global delivery fee.
- Update `handleSaveEdit` to remove logic for global type changes and delivery fees.

### 2. `src/routes/t.$token.tsx` (Customer Side)

- Remove global `orderType`, `customerPhone`, and `deliveryAddress` state variables.
- Remove the global fulfillment selector and delivery fields from the cart.
- Update `handlePlaceOrder` to determine the order `type` based on cart contents (similar to staff side).
- Remove delivery fee logic from subtotal and total calculations.
- Clean up the UI to focus on per-item fulfillment selection.

## Technical Details

- **Order Type Derivation**: If at least one item in the order is marked as `dine_in`, the order row in the database will be tagged as `type: 'dine_in'`. Otherwise, it will be `type: 'takeaway'`.
- **Fulfillment Persistence**: Individual item fulfillment preferences are already stored in `order_items.fulfillment_type`.
- **UI Cleanup**: The removal of global selectors simplifies the interface and reduces potential confusion when items have different fulfillment types.

## Verification Plan

- **Automated Tests**:
    - Verify that placing an order with mixed items correctly sets the order type to `dine_in`.
    - Verify that placing an order with only takeaway items sets the order type to `takeaway`.
    - Confirm the absence of the global "Order Type" selector in the browser for both staff and customer views.
- **Manual Verification**:
    - Check the `/orders` page cart and edit dialog for the removed selectors.
    - Check the `/t/$token` page for the removed delivery fields and global fulfillment selector.
