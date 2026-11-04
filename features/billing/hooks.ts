import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/SessionProvider";
import { getMySubscription, openBillingPortal, startCheckout } from "./api";

export const billingKeys = {
  subscription: (userId: string) => ["billing", "subscription", userId] as const,
};

export function useSubscription() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: billingKeys.subscription(userId ?? ""),
    queryFn: () => getMySubscription(userId!),
    enabled: !!userId,
  });
}

export function useBillingRedirect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: "checkout" | "portal") =>
      action === "checkout" ? startCheckout() : openBillingPortal(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "quota"] });
    },
  });
}
