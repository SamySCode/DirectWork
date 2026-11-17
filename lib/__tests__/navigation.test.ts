import { goBackOr } from "../navigation";

const router = (canGoBack: boolean) => ({
  canGoBack: () => canGoBack,
  back: jest.fn(),
  replace: jest.fn(),
});

describe("goBackOr", () => {
  it("goes back to where the person came from", () => {
    const r = router(true);
    goBackOr(r, "/profile");
    expect(r.back).toHaveBeenCalled();
    expect(r.replace).not.toHaveBeenCalled();
  });

  it("goes somewhere sensible when the screen was opened directly", () => {
    const r = router(false);
    goBackOr(r, "/profile");
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledWith("/profile");
  });
});
