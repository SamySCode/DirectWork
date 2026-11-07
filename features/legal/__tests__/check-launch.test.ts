const {
  findDocumentPlaceholders,
  findOperatorPlaceholders,
} = require("../../../scripts/check-launch");

describe("check:launch", () => {
  it("flags unfilled operator details", () => {
    const problems: string[] = findOperatorPlaceholders({
      legalName: "Acme Ltd",
      address: "[ADDRESS]",
      supportEmail: "",
    });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("address");
  });

  it("passes when everything is filled in", () => {
    expect(
      findOperatorPlaceholders({ legalName: "Acme Ltd", companyNumber: "not applicable" }),
    ).toEqual([]);
  });

  it("finds [PLACEHOLDERS] in document text but not array syntax", () => {
    const problems: string[] = findDocumentPlaceholders([
      ["a.ts", 'const x = [p("Contact [EMAIL PROVIDER] today")]; rows[0];'],
    ]);
    expect(problems).toEqual(["a.ts: [EMAIL PROVIDER]"]);
  });

  it("flags today's operator.json, which still has placeholders", () => {
    const operator = require("../operator.json");
    expect(findOperatorPlaceholders(operator).length).toBeGreaterThan(0);
  });
});

export {};
