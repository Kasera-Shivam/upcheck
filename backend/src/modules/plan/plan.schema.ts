import { z } from "zod";
import { nanoIdSchema } from "../../schemas/common.schema";

const CreateOrderSchema = z.object({ planId: nanoIdSchema });

const VerifyPaymentSchema = z.object({
  planId: nanoIdSchema,
  razorpay_order_id: z.string().trim().min(1, "Order ID is required."),
  razorpay_payment_id: z.string().trim().min(1, "Payment ID is required."),
  razorpay_signature: z.string().trim().min(1, "Signature is required."),
});

export default { CreateOrderSchema, VerifyPaymentSchema };
export type CreateOrderSchema = z.infer<typeof CreateOrderSchema>;
export type VerifyPaymentSchema = z.infer<typeof VerifyPaymentSchema>;
