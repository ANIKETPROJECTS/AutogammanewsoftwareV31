import mongoose from "mongoose";
import { connectDB } from "../db";
import { VendorPurchaseModel } from "../storage";

/**
 * Backfill legacy purchase items with the sale price they previously supplied
 * to accessory masters. The old sync used sellingPrice, then unitPrice.
 * Existing non-null sellCost values are left untouched.
 */
export async function backfillVendorSellCost() {
  await connectDB();
  const result = await VendorPurchaseModel.collection.updateMany(
    { "items.0": { $exists: true } },
    [{
      $set: {
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              $mergeObjects: [
                "$$item",
                {
                  sellCost: {
                    $ifNull: [
                      "$$item.sellCost",
                      {
                        $let: {
                          vars: {
                            previousSell: {
                              $convert: {
                                input: "$$item.sellingPrice",
                                to: "double",
                                onError: 0,
                                onNull: 0,
                              },
                            },
                          },
                          in: {
                            $cond: [
                              { $gt: ["$$previousSell", 0] },
                              "$$previousSell",
                              {
                                $convert: {
                                  input: "$$item.unitPrice",
                                  to: "double",
                                  onError: 0,
                                  onNull: 0,
                                },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    }],
  );
  console.log(
    `Vendor sell-cost migration complete: ${result.modifiedCount} purchase record(s) updated.`,
  );
}

backfillVendorSellCost()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Vendor sell-cost migration failed:", error instanceof Error ? error.message : "Unknown error");
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
