import { describe, expect, it } from "vitest";
import { deriveFieldName } from "../lib/xml/expressionBuilder";

describe("deriveFieldName", () => {
  it("returns the value unchanged when there's no :: prefix", () => {
    expect(deriveFieldName("onLoad")).toBe("onLoad");
    expect(deriveFieldName("onSubmit")).toBe("onSubmit");
  });

  it("strips a single prefix for 2-segment keys", () => {
    expect(deriveFieldName("CONTACT1::contactsModel*phone3")).toBe("contactsModel*phone3");
    expect(deriveFieldName("APPLICANT::applicant*phone2")).toBe("applicant*phone2");
    expect(deriveFieldName("WORKFLOW::department")).toBe("department");
  });

  it("returns FORM when the last segment is literally FORM, regardless of segment count", () => {
    expect(deriveFieldName("ASI::FORM")).toBe("FORM");
    expect(deriveFieldName("ASIT::MOBILE FOOD UNITS::FORM")).toBe("FORM");
    expect(deriveFieldName("WORKFLOW::FORM")).toBe("FORM");
  });

  it("builds the app_spec_info_ pattern for 3+ segment ASI/TSI keys", () => {
    expect(deriveFieldName("ASI::BUSINESS BASICS::Business Activity")).toBe(
      "app_spec_info_BUSINESS_BASICS_Business_Activity"
    );
    expect(deriveFieldName("ASI::PURCHASE INFORMATION::Purchased Business")).toBe(
      "app_spec_info_PURCHASE_INFORMATION_Purchased_Business"
    );
    expect(deriveFieldName("TSI::TERMINATION REASON::Application Termination Reason")).toBe(
      "app_spec_info_TERMINATION_REASON_Application_Termination_Reason"
    );
  });

  it("URL-encodes slashes in the field label the way real exports do", () => {
    expect(deriveFieldName("ASI::LOCATION ADDRESS::ZIP Code/Province Postal Code")).toBe(
      "app_spec_info_LOCATION_ADDRESS_ZIP_Code%2FProvince_Postal_Code"
    );
  });

  it("refuses to guess for ASIT repeating-table fields (real names are positional, not text-derivable)", () => {
    expect(deriveFieldName("ASIT::MOBILE FOOD UNITS::Mobile Unit Type")).toBeNull();
    expect(deriveFieldName("ASIT::MOBILE FOOD UNITS::Status")).toBeNull();
  });

  it("returns null for an empty or blank key", () => {
    expect(deriveFieldName("")).toBeNull();
    expect(deriveFieldName("   ")).toBeNull();
  });
});
