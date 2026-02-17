/**
 * Seed sample documents for demo agents
 * Run with: npx tsx scripts/seed-documents.ts
 */

const SAMPLE_MENU = `
# Straits Kitchen Menu

## Appetizers

### Satay Platter - $16
Grilled chicken and beef satay with peanut sauce
- Contains: Peanuts, Soy
- Gluten-free option available

### Spring Rolls (4 pcs) - $12
Crispy vegetable spring rolls with sweet chili sauce
- Vegetarian
- Contains: Gluten, Sesame

### Tom Yum Soup - $14
Spicy and sour Thai soup with shrimp, mushrooms, and lemongrass
- Spicy level: Medium
- Contains: Shellfish
- Gluten-free

## Main Courses

### Hainanese Chicken Rice - $22
Poached chicken served with fragrant rice, chili sauce, and ginger paste
- Chef's recommendation
- Gluten-free

### Pad Thai - $18
Stir-fried rice noodles with shrimp, tofu, egg, and bean sprouts
- Contains: Shellfish, Peanuts, Egg
- Vegetarian option available (replace shrimp with extra tofu)

### Rendang Beef - $28
Slow-cooked beef in rich coconut curry
- Spicy level: Medium-Hot
- Gluten-free
- Contains: Coconut

### Laksa - $20
Spicy coconut curry noodle soup with shrimp and fish cake
- Spicy level: Hot
- Contains: Shellfish, Coconut
- Our signature dish

### Nasi Goreng - $16
Indonesian fried rice with chicken, egg, and vegetables
- Contains: Egg, Soy
- Vegetarian option available

## Vegetarian Options

### Buddha Bowl - $18
Brown rice, roasted vegetables, tofu, and tahini dressing
- Vegan
- Gluten-free

### Vegetable Curry - $16
Mixed vegetables in yellow curry sauce with jasmine rice
- Vegan
- Gluten-free
- Spicy level: Mild

## Desserts

### Mango Sticky Rice - $12
Sweet coconut sticky rice with fresh mango
- Contains: Coconut
- Gluten-free
- Seasonal availability

### Pandan Cake - $10
Green pandan-flavored sponge cake with coconut cream
- Contains: Egg, Coconut, Gluten

### Ice Cream Selection - $8
Choice of coconut, mango, or green tea ice cream
- Vegan options available

## Beverages

### Thai Iced Tea - $6
Classic sweet Thai tea with condensed milk

### Fresh Coconut - $8
Young coconut served chilled

### Teh Tarik - $5
Pulled milk tea, Malaysian style

### House Wine (Glass) - $12
Ask server for current selection

## Kids Menu (12 and under)

### Mini Chicken Rice - $12
Half portion of Hainanese Chicken Rice

### Chicken Satay (3 pcs) - $10
With mild peanut sauce

### Plain Noodles - $8
Buttered egg noodles

---

**Allergen Notice**: Please inform your server of any dietary restrictions or allergies. Our kitchen handles nuts, shellfish, dairy, and gluten.

**Spicy Levels**: Mild / Medium / Hot / Thai Hot (by request)

**Reservations**: For parties of 6 or more, please call ahead.
`;

const SAMPLE_PRODUCT_CATALOG = `
# TechMart Product Catalog

## Current Promotions
- **SAVE10**: 10% off any purchase over $500
- **STUDENT15**: 15% off with valid student ID
- **BUNDLE20**: 20% off when buying laptop + accessory

---

## Laptops

### UltraBook Pro X1 - $1,499
**SKU:** LT-UBP-X1-001
- 14" 2.8K OLED Display (90Hz, 100% DCI-P3)
- Intel Core i7-13700H (14 cores)
- 16GB LPDDR5 RAM
- 512GB PCIe Gen4 NVMe SSD
- Intel Iris Xe Graphics
- 12-hour battery life
- Weight: 1.4kg
- Thunderbolt 4, USB-C, HDMI 2.1
- **Rating:** ★★★★★ (4.8/5 from 234 reviews)
- **Best for:** Business professionals, developers, content creators
- **Warranty:** 2 years standard, extendable to 3 years

### Gaming Beast RTX - $1,899
**SKU:** LT-GBR-001
- 16" QHD 240Hz IPS Display (G-Sync)
- NVIDIA GeForce RTX 4070 (8GB GDDR6)
- AMD Ryzen 9 7945HX
- 32GB DDR5-5600 RAM
- 1TB PCIe Gen4 NVMe SSD
- Per-key RGB keyboard
- 4-zone cooling system
- Weight: 2.4kg
- **Rating:** ★★★★★ (4.9/5 from 156 reviews)
- **Best for:** Gaming, 3D rendering, video editing, streaming
- **Warranty:** 2 years standard

### Budget Student Laptop - $449
**SKU:** LT-BSL-001
- 15.6" FHD IPS Display
- Intel Core i5-1235U
- 8GB DDR4 RAM (upgradeable to 32GB)
- 256GB NVMe SSD
- Intel UHD Graphics
- 8-hour battery life
- Weight: 1.8kg
- **Rating:** ★★★★☆ (4.3/5 from 892 reviews)
- **Best for:** Students, web browsing, office work, light gaming
- **Warranty:** 1 year standard
- **Note:** Eligible for STUDENT15 discount

---

## Smartphones

### FlagshipPhone 15 Ultra - $1,199
**SKU:** SP-FP15U-256
- 6.8" Dynamic AMOLED 2X (120Hz, 2400 nits peak)
- Latest Snapdragon 8 Gen 3 processor
- 12GB RAM / 256GB storage (also available in 512GB for $1,299)
- Triple camera: 200MP main + 50MP ultrawide + 10MP 3x telephoto
- 5000mAh battery with 45W fast charging
- IP68 water resistant
- 5G + Wi-Fi 7
- **Rating:** ★★★★★ (4.7/5 from 567 reviews)
- **Best for:** Photography enthusiasts, power users, mobile professionals
- **Warranty:** 2 years

### MidRange Champion - $549
**SKU:** SP-MRC-128
- 6.5" AMOLED 120Hz Display
- Snapdragon 7+ Gen 2
- 8GB RAM / 128GB storage (expandable via microSD)
- Triple camera: 64MP main + 12MP ultrawide + 5MP macro
- 4500mAh battery with 33W charging
- IP54 splash resistant
- 5G enabled
- **Rating:** ★★★★☆ (4.5/5 from 1,234 reviews)
- **Best for:** Value-conscious buyers wanting flagship features
- **Warranty:** 1 year
- **Note:** Best value in category!

---

## Accessories

### ProPods Max - $349
**SKU:** AC-PPM-001
- Over-ear wireless headphones
- Active Noise Cancellation (ANC)
- Spatial Audio support
- 30-hour battery life
- Premium aluminum and leather construction
- Bluetooth 5.3 + 3.5mm wired option
- **Rating:** ★★★★★ (4.8/5 from 445 reviews)
- **Best for:** Audiophiles, frequent travelers, work-from-home professionals
- **Colors:** Space Gray, Silver, Midnight Blue, Rose Gold

### SmartWatch Ultra 2 - $449
**SKU:** AC-SWU2-001
- 49mm titanium case
- Always-on OLED Retina display (2000 nits)
- GPS + Cellular + Dual-frequency
- 72-hour battery life in normal use
- 100m water resistant (EN13319 dive certified)
- ECG, Blood Oxygen, Temperature sensing
- **Rating:** ★★★★★ (4.9/5 from 298 reviews)
- **Best for:** Athletes, outdoor enthusiasts, fitness tracking
- **Colors:** Titanium Natural, Titanium Black

### USB-C Hub Pro - $79
**SKU:** AC-UCH-001
- 7-in-1 USB-C hub
- 4K HDMI @ 60Hz
- 2x USB-A 3.2 ports
- 1x USB-C data port
- SD + microSD card readers
- 100W Power Delivery passthrough
- Aluminum body with braided cable
- **Rating:** ★★★★☆ (4.4/5 from 678 reviews)
- **Best for:** Laptop users needing more connectivity
- **Compatible with:** All USB-C laptops and tablets

### Wireless Charging Pad - $39
**SKU:** AC-WCP-001
- 15W fast wireless charging
- Qi2 / MagSafe compatible
- LED indicator (dim mode for bedroom)
- Non-slip surface
- **Rating:** ★★★★☆ (4.2/5 from 923 reviews)

---

## Bundles & Deals

### Work From Home Bundle - $1,699 (Save $148)
- UltraBook Pro X1 ($1,499)
- USB-C Hub Pro ($79)
- Wireless Charging Pad ($39)
- ProPods Max ($349) → **FREE**
**SKU:** BDL-WFH-001

### Student Starter Pack - $549 (Save $78)
- Budget Student Laptop ($449)
- USB-C Hub Pro ($79)
- 1-year extended warranty ($49)
- Laptop sleeve → **FREE**
**SKU:** BDL-STU-001
**Note:** Stack with STUDENT15 for additional savings!

---

## Store Policies
- **Free Shipping:** On orders over $99
- **Returns:** 30-day no-questions-asked return policy
- **Price Match:** We match any authorized retailer's price
- **Financing:** 0% APR for 12 months on purchases over $500
`;

const SUPPORT_KNOWLEDGE_BASE = `
# TechMart Support Knowledge Base

## Quick Reference
- **Support Hours:** 24/7 Live Chat, Phone 8AM-10PM EST
- **Support Email:** support@techmart.example.com
- **Support Phone:** 1-800-TECH-HELP (1-800-832-4435)
- **Warranty Portal:** warranty.techmart.example.com

---

## KB-1001: Display Flickering (UltraBook Pro X1)

**Symptoms:**
- Screen flickers intermittently
- Display briefly goes black
- Flickering worse on battery power

**Affected Products:** UltraBook Pro X1 (LT-UBP-X1-001)

**Resolution Steps:**
1. **Update Display Drivers**
   - Open Device Manager > Display adapters
   - Right-click Intel Iris Xe Graphics > Update driver
   - Restart the laptop

2. **Disable Panel Self-Refresh**
   - Open Intel Graphics Command Center
   - Go to System > Power
   - Turn OFF "Panel Self-Refresh"

3. **Check Power Settings**
   - Go to Settings > System > Power & Battery
   - Set "Screen refresh rate" to 90Hz (not variable)

4. **BIOS Update**
   - Download latest BIOS from support.techmart.example.com/ultrabook-x1
   - Version 1.08 or later fixes known display issues

**If issue persists:** Escalate to Level 2 Support or initiate warranty replacement.

---

## KB-1002: Battery Draining Quickly

**Symptoms:**
- Battery depletes faster than expected
- Battery health shows degradation
- Laptop runs hot during normal use

**Affected Products:** All laptops

**Resolution Steps:**
1. **Check Battery Health**
   - Open Command Prompt as Administrator
   - Run: powercfg /batteryreport
   - Review "Design Capacity" vs "Full Charge Capacity"
   - If below 80%, battery may need replacement

2. **Identify Power-Hungry Apps**
   - Open Task Manager > Processes
   - Sort by Power usage
   - Close or uninstall problematic apps

3. **Optimize Power Settings**
   - Use "Balanced" or "Power Saver" mode
   - Reduce screen brightness to 50-70%
   - Disable keyboard backlight when not needed

4. **Background App Management**
   - Settings > Apps > Installed apps
   - Disable background activity for non-essential apps

5. **BIOS and Driver Updates**
   - Update BIOS to latest version
   - Update chipset and power management drivers

**Warranty Info:** Battery replacement covered for 1 year, 2 years for UltraBook Pro X1.

---

## KB-1003: Keyboard Not Responding

**Symptoms:**
- Keys don't register
- Keyboard works intermittently
- Some keys stuck or not working

**Affected Products:** All laptops

**Resolution Steps:**
1. **Basic Troubleshooting**
   - Restart the laptop
   - Check for debris under keys (use compressed air)
   - Try connecting an external USB keyboard

2. **Driver Reinstall**
   - Open Device Manager
   - Expand "Keyboards"
   - Right-click > Uninstall device
   - Restart laptop (driver auto-reinstalls)

3. **Check for Hardware Issues**
   - Boot into BIOS (press F2 during startup)
   - Test if keyboard works in BIOS
   - If works in BIOS: Software issue
   - If doesn't work in BIOS: Hardware issue → Warranty

4. **Filter Keys Check**
   - Settings > Accessibility > Keyboard
   - Ensure "Filter keys" is OFF

**Escalation:** If external keyboard works but internal doesn't, likely hardware failure. Initiate warranty service.

---

## KB-2001: Phone Not Charging (FlagshipPhone 15 Ultra)

**Symptoms:**
- Phone doesn't charge when plugged in
- Charging is very slow
- Wireless charging not working

**Affected Products:** FlagshipPhone 15 Ultra (SP-FP15U-*)

**Resolution Steps:**
1. **Check Charging Cable and Adapter**
   - Use original 45W charger
   - Try a different USB-C cable
   - Inspect port for debris or damage

2. **Clean Charging Port**
   - Power off the phone
   - Use plastic toothpick or compressed air
   - Gently remove lint/debris

3. **Software Reset**
   - Settings > Battery > Battery usage
   - Check for apps consuming excessive power
   - Restart phone in Safe Mode (hold power + volume down)

4. **Wireless Charging Issues**
   - Remove phone case
   - Center phone on charging pad
   - Ensure charger is Qi2 compatible for 15W

5. **Battery Calibration**
   - Drain battery to 0%
   - Charge to 100% without interruption
   - Leave plugged in for 2 additional hours

**Warranty Info:** Battery and charging port covered for 2 years.

---

## KB-2002: Camera Not Focusing

**Symptoms:**
- Photos are blurry
- Autofocus hunts continuously
- Camera app crashes

**Affected Products:** All smartphones

**Resolution Steps:**
1. **Clean Camera Lens**
   - Use microfiber cloth
   - Check for protective film still on lens
   - Inspect for scratches

2. **Clear Camera Cache**
   - Settings > Apps > Camera > Storage
   - Clear cache (NOT data)
   - Restart camera app

3. **Safe Mode Test**
   - Boot into Safe Mode
   - Test camera
   - If works: Third-party app conflict

4. **Software Update**
   - Check for system updates
   - Camera improvements often in updates

5. **Reset Camera Settings**
   - Open Camera app > Settings (gear icon)
   - Reset settings to default

**Escalation:** If hardware issue suspected (clicking sound, visible damage), initiate warranty claim.

---

## KB-3001: SmartWatch Not Syncing

**Symptoms:**
- Watch won't connect to phone
- Health data not syncing
- Notifications not appearing

**Affected Products:** SmartWatch Ultra 2 (AC-SWU2-001)

**Resolution Steps:**
1. **Restart Both Devices**
   - Power off watch (hold side button)
   - Restart phone
   - Turn watch back on

2. **Check Bluetooth Connection**
   - Phone Settings > Bluetooth
   - Ensure watch is listed and connected
   - If not, forget device and re-pair

3. **Re-Pair Watch**
   - On watch: Settings > General > Reset > Erase All Content
   - On phone: Delete watch from Bluetooth devices
   - Follow initial pairing process again

4. **Update Software**
   - Update phone OS to latest
   - Update watch OS via companion app

5. **Check Notification Settings**
   - Phone app > Watch settings > Notifications
   - Ensure desired apps are enabled

**Known Issue:** Some Android 14 devices have sync issues - update to latest patch.

---

## Escalation Procedures

### When to Escalate to Level 2:
- Issue persists after all KB steps completed
- Customer reports data loss
- Hardware damage suspected
- Repeated same issue (3+ contacts)

### When to Escalate to Warranty:
- Physical damage from manufacturing defect
- Battery health below 80% within warranty period
- Component failure (screen, keyboard, ports)
- Device dead on arrival

### Warranty Coverage Summary:
| Product | Standard Warranty | Extended Available |
|---------|------------------|-------------------|
| UltraBook Pro X1 | 2 years | +1 year ($149) |
| Gaming Beast RTX | 2 years | +1 year ($199) |
| Budget Student | 1 year | +1 year ($49) |
| FlagshipPhone 15 | 2 years | +1 year ($99) |
| MidRange Champion | 1 year | +1 year ($49) |
| SmartWatch Ultra 2 | 1 year | +1 year ($39) |

---

## Contact Information

**Customer Support:**
- Live Chat: Available 24/7 on techmart.example.com
- Phone: 1-800-TECH-HELP (8AM-10PM EST)
- Email: support@techmart.example.com

**Warranty Claims:**
- Portal: warranty.techmart.example.com
- Email: warranty@techmart.example.com
- Response time: 24-48 hours

**Social Media Support:**
- Twitter/X: @TechMartSupport
- Facebook: /TechMartOfficial
`;

async function seedDocuments() {
  const API_BASE = process.env.API_BASE_URL || "https://straits-agents-web.mystraits-ai.workers.dev";

  console.log("Seeding sample documents...");
  console.log(`Using API base: ${API_BASE}\n`);

  // Seed QR Menu document
  console.log("📄 Seeding QR Menu document...");
  const menuResponse = await fetch(`${API_BASE}/api/agents/qr-menu/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Restaurant Menu - Straits Kitchen",
      content: SAMPLE_MENU,
      contentType: "text/markdown",
    }),
  });

  if (menuResponse.ok) {
    console.log("✅ Menu document seeded for qr-menu agent");
  } else {
    console.error("❌ Failed to seed menu:", await menuResponse.text());
  }

  // Seed Retail product catalog
  console.log("\n📄 Seeding Retail product catalog...");
  const catalogResponse = await fetch(`${API_BASE}/api/agents/retail/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "TechMart Product Catalog - Complete Inventory",
      content: SAMPLE_PRODUCT_CATALOG,
      contentType: "text/markdown",
    }),
  });

  if (catalogResponse.ok) {
    console.log("✅ Product catalog seeded for retail agent");
  } else {
    console.error("❌ Failed to seed catalog:", await catalogResponse.text());
  }

  // Seed Support knowledge base
  console.log("\n📄 Seeding Support knowledge base...");
  const supportResponse = await fetch(`${API_BASE}/api/agents/support/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "TechMart Support Knowledge Base",
      content: SUPPORT_KNOWLEDGE_BASE,
      contentType: "text/markdown",
    }),
  });

  if (supportResponse.ok) {
    console.log("✅ Support knowledge base seeded for support agent");
  } else {
    console.error("❌ Failed to seed support KB:", await supportResponse.text());
  }

  console.log("\n✨ Document seeding complete!");
  console.log("\nSeeded documents:");
  console.log("  - QR Menu: Restaurant menu with appetizers, mains, desserts, beverages");
  console.log("  - Retail: Product catalog with laptops, phones, accessories, bundles");
  console.log("  - Support: Knowledge base with troubleshooting guides (KB-1001 to KB-3001)");
}

seedDocuments().catch(console.error);
