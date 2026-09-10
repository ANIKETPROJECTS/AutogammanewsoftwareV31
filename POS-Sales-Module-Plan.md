# POS / Sales Module

## Simple explanation

The client currently creates a job card and then manually writes down what was sold.

The new **POS / Sales module** will make this easier. It will work like a billing counter:

1. Select the customer and vehicle.
2. Select the services and accessories that were sold.
3. Review the items and total amount.
4. Record the payment.
5. Generate the invoice.

The user will not need to type every sold item manually.

---

## What does POS mean?

POS means **Point of Sale**.

It is the screen used when the business is selling something to a customer. In this project, the POS screen will allow the user to sell:

- Services
- PPF work
- Accessories
- Labour charges

The items will come from the existing master data. The user will select them instead of typing their names and prices again.

---

## Why do we need this module?

At the moment, the user has to:

- Create a job card.
- Manually enter what was sold.
- Manually calculate or check the amount.
- Prepare the invoice.

This can cause:

- Typing mistakes.
- Incorrect prices.
- Missing accessories.
- Incorrect quantities.
- Extra work for the staff.

The POS module will make the process faster and more reliable.

---

## Main POS screen

The screen can be divided into two parts.

### Left side: Items to select

The user can search and select items from tabs such as:

- Services
- PPF
- Accessories
- Labour

Example:

```text
Services
  Ceramic Coating       ₹25,000
  Interior Detailing    ₹8,000

Accessories
  Leather Seats         ₹3,000
  Heavy Duty Lights     ₹5,000
```

The user clicks an item to add it to the bill.

### Right side: Current bill

The selected items appear in a cart or bill area.

Example:

| Item | Type | Quantity | Price | Total |
|---|---|---:|---:|---:|
| Ceramic Coating | Service | 1 | ₹25,000 | ₹25,000 |
| Leather Seats | Accessory | 2 | ₹3,000 | ₹6,000 |

The user should be able to:

- Change the quantity.
- Remove an item.
- Review the price.
- Apply a discount.
- Add GST.
- Add a note.
- See the final total.

---

## Customer and vehicle selection

Before completing a sale, the user can:

- Search for an existing customer using their phone number.
- Select the customer's vehicle.
- Create a new customer if the customer does not already exist.
- Link the sale to an existing job card.

The customer and vehicle details should automatically appear on the invoice.

Walk-in sales should also be possible if the business wants to sell an accessory without creating a complete job card.

---

## How the sale should work

The normal process will be:

```text
Select customer
       ↓
Select vehicle, if applicable
       ↓
Select services and accessories
       ↓
Review the bill
       ↓
Apply discount and GST
       ↓
Record payment
       ↓
Confirm sale
       ↓
Create invoice
```

The sale may also be connected to an existing job card:

```text
Existing job card
       ↓
Add additional services or accessories
       ↓
Confirm sale
       ↓
Update invoice and stock
```

---

## Payment options

The POS screen can support:

- Cash
- UPI
- Card
- Bank transfer
- Part payment
- Credit or unpaid amount

For a part payment, the system should show:

- Total bill amount.
- Amount received.
- Remaining amount.
- Payment status.

Example:

```text
Total amount:       ₹34,000
Amount received:    ₹20,000
Remaining amount:   ₹14,000
Status:             Partially paid
```

---

## Invoice

After the user confirms the sale, the system should create an invoice containing:

- Invoice number.
- Date.
- Customer name.
- Customer phone number.
- Vehicle details.
- Selected services.
- Selected accessories.
- Quantities.
- Prices.
- Discount.
- GST.
- Total amount.
- Payment details.
- Remaining amount, if any.

The invoice should use the existing invoice format where possible.

---

## Stock handling for accessories

When an accessory is sold, its stock should reduce automatically.

Example:

```text
Leather Seats stock before sale: 10
Quantity sold:                    2
Leather Seats stock after sale:   8
```

Stock should be reduced only after the sale is confirmed. Adding an item to the cart should not reduce stock.

If a sale is cancelled, the stock should be added back.

The system must also make sure that stock is not reduced twice when the same accessory is connected to both a POS sale and a job card.

---

## Important price rule

When an item is added to a sale, the system should save the item details at that time:

- Item name.
- Item type.
- Price.
- HSN code.
- GST information.
- Quantity.

This is important because the master price may change later.

For example:

```text
Today:
Leather Seats = ₹3,000

Next month:
Leather Seats = ₹3,500
```

An old invoice should still show ₹3,000. It should not change to ₹3,500 just because the master price was updated.

---

## Recommended pages

### 1. New Sale / POS

The main billing screen where the user selects items and completes a sale.

### 2. Sales History

A list of all previous sales showing:

- Sale number.
- Date.
- Customer.
- Vehicle.
- Linked job card.
- Total amount.
- Payment status.
- View invoice button.

### 3. Sale Details

A separate page showing:

- Customer details.
- Vehicle details.
- All sold items.
- Discounts and GST.
- Payment history.
- Stock-related information.
- Linked job card.

---

## How this connects to the existing system

The current application already has:

- Service Master.
- PPF Master.
- Accessories Master.
- Accessory categories.
- HSN codes.
- Job cards.
- Invoices.
- Accessory stock.

The POS module should use these existing masters. It should not create a second place to manage service names, accessory names, or prices.

The existing masters will remain the source of item information.

---

## Job card connection

There are two possible ways to use the POS module.

### Option A: POS only inside a job card

The user must create a job card first. The POS screen is used to select items for that job.

This is simple and works well when every sale is connected to vehicle work.

### Option B: Separate POS module

The user can create a sale without a job card, or connect the sale to an existing job card.

This is more flexible and supports:

- Walk-in accessory sales.
- Additional accessories added after a job has started.
- Direct counter sales.
- Sales that are not related to a complete job card.

### Recommended option

Use a separate POS module with an optional job card link.

This gives the business both options:

- Sell through a job card when needed.
- Make a direct sale when a job card is not needed.

---

## Suggested sale statuses

Each sale can have a status such as:

- Draft.
- Confirmed.
- Partially paid.
- Paid.
- Cancelled.
- Refunded, if refunds are required later.

The first version can start with:

- Draft.
- Paid.
- Partially paid.
- Unpaid.
- Cancelled.

---

## Questions to confirm with the client

Before development starts, confirm these points:

1. Should walk-in customers be allowed without creating a customer record?
2. Should every sale require a vehicle?
3. Should a sale be allowed without a job card?
4. Should services automatically create a job card?
5. Should PPF be included in the POS screen?
6. Should the user be allowed to change the price during checkout?
7. Should the user be allowed to give an item-level discount?
8. Should GST be calculated automatically?
9. Should partial payments be supported?
10. Should cancelled sales restore accessory stock?
11. Should the POS sale update an existing invoice or create a new invoice?
12. Should a POS sale be linkable to an existing job card?
13. Should users be allowed to sell an accessory when its stock is zero?
14. Should the system print or download the invoice immediately after checkout?

---

## Simple example

An employee receives a car for service.

The employee opens **POS / New Sale** and:

1. Searches for the customer by phone number.
2. Selects the customer's car.
3. Adds:
   - Ceramic Coating.
   - Leather Seats.
   - Heavy Duty Lights.
4. Changes the Leather Seats quantity to 2.
5. Applies a discount.
6. Records a ₹20,000 UPI payment.
7. Confirms the sale.

The system then:

- Saves the selected items.
- Calculates the final total.
- Reduces accessory stock.
- Records the payment.
- Shows the remaining amount.
- Generates the invoice.
- Links the sale to the job card, if selected.

---

## Final recommendation

Build this as a separate **POS / Sales** module connected to the existing:

- Customer data.
- Vehicle data.
- Service Master.
- PPF Master.
- Accessories Master.
- Job cards.
- Stock.
- Invoices.

The POS module should not replace the existing masters. It should make it easier to select those existing items, calculate the bill, collect payment, update stock, and create an invoice.
