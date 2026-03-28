const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const NICK_FORM_URL = "https://form.jotform.com/260766386263163";

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/submit-to-nick", async (req, res) => {
  const data = req.body;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(NICK_FORM_URL, { waitUntil: "networkidle", timeout: 30000 });

    // Borrower Name / Business Entity
    if (data.borrower_name_business_entity) {
      await page.fill("#input_5", data.borrower_name_business_entity);
    }

    // Phone Number — Nick's form uses a masked phone input (area, phone)
    if (data.phone_number) {
      const digits = data.phone_number.replace(/\D/g, "");
      const area = digits.slice(0, 3);
      const rest = digits.slice(3);
      const areaInput = page.locator("input[id='input_41_area']");
      const phoneInput = page.locator("input[id='input_41_phone']");
      if (await areaInput.count() > 0) {
        await areaInput.fill(area);
        await phoneInput.fill(rest);
      } else {
        // Fallback: single phone field
        await page.fill("#input_41", data.phone_number);
      }
    }

    // Email
    if (data.email) {
      await page.fill("#input_37", data.email);
    }

    // Property Address
    if (data.property_address) {
      await page.fill("#input_12", data.property_address);
    }

    // Purchase Price
    if (data.purchase_price) {
      await page.fill("#input_17", data.purchase_price);
    }

    // Estimated Credit Score
    if (data.credit_score) {
      await page.fill("#input_6", data.credit_score);
    }

    // How Many Flips in Last 3 Years
    if (data.flips_in_last_3_years) {
      await page.fill("#input_7", data.flips_in_last_3_years);
    }

    // Exit Strategy
    if (data.exit_strategy) {
      await page.fill("#input_57", data.exit_strategy);
    }

    // Click submit
    await page.click("#input_36");

    // Wait for navigation or thank-you confirmation
    await page.waitForURL("**/thankyou**", { timeout: 15000 }).catch(() => {
      // Some forms show inline confirmation instead of redirect
    });

    // Check for success indicators
    const url = page.url();
    const content = await page.content();
    const success =
      url.includes("thankyou") ||
      content.includes("Thank You") ||
      content.includes("thank you") ||
      content.includes("submitted");

    await browser.close();
    browser = null;

    if (success) {
      res.json({
        success: true,
        message: "Form submitted to Nick successfully",
        fieldsSubmitted: Object.keys(data),
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Form submission may have failed — no confirmation detected",
      });
    }
  } catch (err) {
    if (browser) await browser.close();
    console.error("Submission error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`nick-autosubmit listening on port ${PORT}`);
});
