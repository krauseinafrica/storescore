"""
Seed the platform catalog with all-industry DepartmentType records.

Usage:
    python manage.py seed_department_types
    python manage.py seed_department_types --clear  # Delete existing records first
"""

import logging

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.walks.models import DepartmentType

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper to build a consistent scoring guidance string
# ---------------------------------------------------------------------------
SCORING_GUIDANCE = '5=Excellent, 4=Good, 3=Average, 2=Fair, 1=Poor'


def _criteria(*items):
    """Return a list of criteria dicts from (name, description) tuples."""
    return [
        {
            'name': name,
            'description': description,
            'order': idx,
            'max_points': 5,
            'scoring_guidance': SCORING_GUIDANCE,
        }
        for idx, (name, description) in enumerate(items)
    ]


def _sections(*items):
    """Return a sections list from (name, criteria_tuples) pairs."""
    return [
        {
            'name': name,
            'order': idx,
            'weight': '1.00',
            'criteria': _criteria(*criteria_tuples),
        }
        for idx, (name, criteria_tuples) in enumerate(items)
    ]


# ═══════════════════════════════════════════════════════════════════════════
# Department types by industry
# ═══════════════════════════════════════════════════════════════════════════

DEPARTMENT_TYPES = [

    # ══════════════════════════════════════════════════════════════════════
    # HARDWARE / HOME IMPROVEMENT
    # ══════════════════════════════════════════════════════════════════════

    # ── Standard ──────────────────────────────────────────────────────
    {
        'name': 'Paint',
        'description': 'Interior and exterior paint, stains, primers, and color-matching services.',
        'icon_name': 'paint-roller',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Color Mixing Area', (
                    ('Machine Cleanliness', 'Evaluate cleanliness and maintenance of tinting/mixing machines.'),
                    ('Color Swatch Availability', 'Are fan decks, chips, and sample cards fully stocked and organized?'),
                    ('Mixing Accuracy Signage', 'Is there clear signage explaining the color-matching process and turnaround times?'),
                )),
                ('Display Walls', (
                    ('Product Arrangement', 'Are paint cans organized by brand, finish, and type with clear shelf labels?'),
                    ('Sample Display Condition', 'Are sample pint displays clean, undamaged, and correctly priced?'),
                    ('Lighting & Visibility', 'Is the display wall well-lit so customers can accurately evaluate colors?'),
                )),
                ('Supplies Organization', (
                    ('Brush & Roller Stock', 'Are brushes, rollers, and trays fully stocked and sorted by size/type?'),
                    ('Tape & Prep Supplies', 'Are painter\'s tape, drop cloths, and prep products easy to find?'),
                    ('Accessory Cross-Merchandising', 'Are complementary accessories merchandised near relevant paint products?'),
                )),
            ),
        },
    },
    {
        'name': 'Lumber',
        'description': 'Dimensional lumber, sheet goods, treated wood, and moulding.',
        'icon_name': 'tree',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Storage & Organization', (
                    ('Rack Condition', 'Are lumber racks sturdy, labeled by species/dimension, and free of debris?'),
                    ('Aisle Accessibility', 'Can customers navigate aisles easily with carts or flatbeds?'),
                    ('Inventory Rotation', 'Is older stock rotated forward and damaged pieces culled regularly?'),
                )),
                ('Safety', (
                    ('Forklift Area Markings', 'Are forklift zones clearly marked with floor paint and warning signs?'),
                    ('PPE Availability', 'Are gloves and other protective equipment available for customer use?'),
                    ('Overhead Signage', 'Are height-clearance and weight-limit signs posted where required?'),
                )),
                ('Product Quality', (
                    ('Board Condition', 'Are boards free of excessive warping, splits, and mold?'),
                    ('Grading Accuracy', 'Do grade stamps match the labeled product and pricing?'),
                    ('Moisture Protection', 'Is stored lumber protected from rain, ground moisture, and direct sun?'),
                )),
            ),
        },
    },
    {
        'name': 'Plumbing',
        'description': 'Pipes, fittings, fixtures, water heaters, and plumbing tools.',
        'icon_name': 'wrench',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Fixture Displays', (
                    ('Working Display Models', 'Are faucet and fixture displays operational and clean?'),
                    ('Price & Spec Tags', 'Does every displayed fixture have visible pricing and specification details?'),
                    ('Display Maintenance', 'Are displays free of water stains, mineral buildup, and damage?'),
                )),
                ('Parts Organization', (
                    ('Bin Labeling', 'Are small-parts bins clearly labeled with part number and description?'),
                    ('Stock Levels', 'Are bins and pegs adequately stocked without being overfilled?'),
                    ('Pipe & Fitting Sorting', 'Are pipes and fittings sorted by material (PVC, copper, PEX) and size?'),
                )),
                ('Knowledge Signage', (
                    ('How-To Guides', 'Are printed or digital how-to guides available for common plumbing repairs?'),
                    ('Code Reference Charts', 'Are local plumbing code reference materials accessible to customers?'),
                    ('Product Comparison Signage', 'Is there signage comparing materials (e.g., PEX vs. copper) for customer education?'),
                )),
            ),
        },
    },
    {
        'name': 'Electrical',
        'description': 'Wiring, outlets, switches, breakers, lighting, and electrical tools.',
        'icon_name': 'bolt',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Organization', (
                    ('Category Grouping', 'Are products grouped logically (wiring, switches, breakers, lighting)?'),
                    ('Shelf Label Accuracy', 'Do shelf labels match the products displayed and show correct pricing?'),
                    ('Lighting Demo Display', 'Are lighting products displayed with working demonstrations where possible?'),
                )),
                ('Safety Compliance', (
                    ('Warning Signage', 'Are electrical safety warnings prominently posted in the department?'),
                    ('Code Reference Materials', 'Are NEC code reference guides or charts available for customers?'),
                    ('Hazardous Product Storage', 'Are high-voltage items and hazardous materials stored according to safety guidelines?'),
                )),
                ('Product Labeling', (
                    ('Wire Gauge Identification', 'Is wire clearly labeled by gauge, type (THHN, Romex, UF), and length?'),
                    ('Amperage & Voltage Labels', 'Are breakers and outlets clearly labeled with amperage and voltage ratings?'),
                    ('Compatibility Notes', 'Are compatibility notes displayed for smart switches, dimmers, and specialty items?'),
                )),
            ),
        },
    },
    {
        'name': 'Tools',
        'description': 'Power tools, hand tools, tool storage, and accessories.',
        'icon_name': 'hammer',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Power Tool Display', (
                    ('Security & Accessibility', 'Are power tools securely displayed yet accessible for customers to handle?'),
                    ('Working Demo Units', 'Are demonstration models available and in working condition?'),
                    ('Battery Platform Organization', 'Are cordless tools organized by battery platform with clear compatibility info?'),
                    ('Pricing & Feature Cards', 'Does each power tool have a feature card with pricing, specs, and comparisons?'),
                )),
                ('Hand Tool Organization', (
                    ('Brand Grouping', 'Are hand tools organized by brand and/or category for easy browsing?'),
                    ('Peg Hook Condition', 'Are peg hooks straight, labeled, and free of empty slots?'),
                    ('Specialty Tool Visibility', 'Are less-common specialty tools easy to locate with clear signage?'),
                )),
                ('Demonstration Area', (
                    ('Demo Table Condition', 'Is the demo/workbench area clean, organized, and inviting?'),
                    ('Sample Materials', 'Are sample materials (wood, drywall) available for customers to test tools?'),
                    ('Safety Equipment', 'Are safety glasses and hearing protection available at the demo station?'),
                )),
            ),
        },
    },
    {
        'name': 'Outdoor/Garden',
        'description': 'Plants, soil, outdoor furniture, grills, and garden tools.',
        'icon_name': 'leaf',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Seasonal Displays', (
                    ('Timeliness', 'Are seasonal products displayed at the appropriate time of year?'),
                    ('Visual Merchandising', 'Are end caps and feature displays visually appealing and well-maintained?'),
                    ('Signage & Pricing', 'Is seasonal signage current with accurate pricing and promotions?'),
                )),
                ('Plant Care Area', (
                    ('Watering & Maintenance', 'Are live plants adequately watered, pruned, and free of dead material?'),
                    ('Labeling & Care Info', 'Do plants have care labels with sun, water, and hardiness-zone information?'),
                    ('Organization by Type', 'Are plants grouped logically (annuals, perennials, shrubs, trees)?'),
                )),
                ('Equipment Storage', (
                    ('Outdoor Power Equipment Display', 'Are mowers, trimmers, and blowers displayed with pricing and feature info?'),
                    ('Fuel & Chemical Storage', 'Are fuels and chemicals stored safely with proper ventilation and signage?'),
                    ('Accessory Availability', 'Are replacement blades, line, filters, and oil stocked near equipment?'),
                )),
            ),
        },
    },
    {
        'name': 'Hardware/Fasteners',
        'description': 'Nuts, bolts, screws, nails, anchors, and general hardware.',
        'icon_name': 'screwdriver',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Organization & Labeling', (
                    ('Bin Label Accuracy', 'Does every bin/drawer have a legible label matching its contents?'),
                    ('Size & Thread Sorting', 'Are fasteners sorted by size, thread pitch, and material (zinc, stainless)?'),
                    ('Measurement Reference Charts', 'Are bolt-size and thread-pitch reference charts posted for customer self-service?'),
                )),
                ('Stock Levels', (
                    ('High-Demand Items', 'Are commonly purchased fasteners (deck screws, drywall screws, lag bolts) fully stocked?'),
                    ('Bulk & Specialty Availability', 'Are both bulk quantities and specialty/less-common fasteners available?'),
                    ('Restock Timeliness', 'Are empty bins restocked promptly with no extended gaps in availability?'),
                )),
                ('Display Condition', (
                    ('Bin & Drawer Condition', 'Are bins, drawers, and display racks clean and undamaged?'),
                    ('Mix-Free Bins', 'Are bins free of mixed/misplaced fasteners that would confuse customers?'),
                    ('Aisle Cleanliness', 'Is the aisle free of loose fasteners, packaging debris, and clutter?'),
                )),
            ),
        },
    },

    # ── Branded ───────────────────────────────────────────────────────
    {
        'name': 'Hallmark',
        'description': 'Greeting cards, gift wrap, ornaments, and seasonal Hallmark merchandise.',
        'icon_name': 'gift',
        'category': 'branded',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Card Display', (
                    ('Category Organization', 'Are cards organized by occasion (birthday, sympathy, holiday) with clear dividers?'),
                    ('Stock Levels', 'Are card pockets full with no noticeable gaps or empty slots?'),
                    ('Display Cleanliness', 'Are card racks clean, straight, and free of bent or damaged cards?'),
                )),
                ('Gift Selection', (
                    ('Product Variety', 'Is there a good variety of gift bags, wrap, and small gift items?'),
                    ('Pricing Visibility', 'Are all gift items clearly priced with visible tags or shelf labels?'),
                    ('Cross-Merchandising', 'Are complementary items (cards + gift bags + tissue paper) merchandised together?'),
                )),
                ('Seasonal Rotation', (
                    ('Timely Changeover', 'Are seasonal displays updated at least 4-6 weeks before each holiday?'),
                    ('Planogram Compliance', 'Does the seasonal layout match the current Hallmark planogram?'),
                    ('Clearance Management', 'Is post-holiday clearance merchandise handled promptly and neatly?'),
                )),
            ),
        },
    },
    {
        'name': 'Stihl',
        'description': 'Stihl chainsaws, trimmers, blowers, and outdoor power equipment.',
        'icon_name': 'chainsaw',
        'category': 'branded',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Product Display', (
                    ('Brand Presentation', 'Is the Stihl display area clean and consistent with Stihl brand guidelines?'),
                    ('Product Range Visibility', 'Are featured models displayed with spec cards and pricing?'),
                    ('Accessory Merchandising', 'Are chains, bars, line, and protective gear merchandised near equipment?'),
                )),
                ('Demo Equipment', (
                    ('Working Demo Units', 'Are demonstration units available, fueled or charged, and in working order?'),
                    ('Staff Readiness', 'Can staff demonstrate products and explain features on request?'),
                    ('Demo Area Safety', 'Is the demo area clear of hazards with appropriate safety signage?'),
                )),
                ('Safety/Storage', (
                    ('Fuel & Oil Storage', 'Are fuel mix, bar oil, and related chemicals stored safely and labeled?'),
                    ('Chain & Blade Security', 'Are replacement chains and blades stored securely out of customer reach if required?'),
                    ('PPE Display', 'Are Stihl-branded helmets, chaps, gloves, and eye protection prominently displayed?'),
                )),
            ),
        },
    },
    {
        'name': 'Carhartt',
        'description': 'Carhartt workwear, outerwear, footwear, and accessories.',
        'icon_name': 'shirt',
        'category': 'branded',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Apparel Display', (
                    ('Visual Merchandising', 'Is the Carhartt section visually appealing with brand-consistent fixtures?'),
                    ('Product Condition', 'Are garments neatly folded or hung, free of wrinkles and stains?'),
                    ('Feature Highlighting', 'Are new arrivals and best-sellers highlighted with signage or positioning?'),
                )),
                ('Sizing Organization', (
                    ('Size Run Completeness', 'Is a full range of sizes (S-3XL+) available for key styles?'),
                    ('Size Label Visibility', 'Are size labels clearly visible on shelves, hangers, or dividers?'),
                    ('Fit Guide Availability', 'Is a Carhartt fit guide available for customers to reference?'),
                )),
                ('Brand Presentation', (
                    ('Signage & Branding', 'Are official Carhartt signs, banners, and fixtures in good condition?'),
                    ('Cleanliness', 'Is the brand area clean, well-lit, and free of non-Carhartt merchandise?'),
                    ('Seasonal Assortment', 'Does the assortment reflect the current season (e.g., insulated gear in winter)?'),
                )),
            ),
        },
    },
    {
        'name': 'Benjamin Moore',
        'description': 'Benjamin Moore paints, stains, and color consultation services.',
        'icon_name': 'palette',
        'category': 'branded',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Color Display', (
                    ('Fan Deck Availability', 'Are Benjamin Moore fan decks and color cards fully stocked and organized?'),
                    ('Color Wall Condition', 'Is the color display wall clean, well-lit, and free of faded samples?'),
                    ('Digital Color Tools', 'Are digital color-matching tools or kiosk stations available and functional?'),
                )),
                ('Sample Organization', (
                    ('Sample Pint/Quart Stock', 'Are sample-size containers available and organized by color family?'),
                    ('Peel & Stick Samples', 'Are peel-and-stick samples available and neatly displayed?'),
                    ('Sample Ordering Process', 'Is the process for ordering custom samples clearly communicated?'),
                )),
                ('Mixing Area', (
                    ('Tinting Machine Condition', 'Is the tinting machine clean, calibrated, and in good working order?'),
                    ('Workspace Cleanliness', 'Is the mixing counter free of spills, dried paint, and clutter?'),
                    ('Product Line Signage', 'Are the different product lines (Regal, Aura, ben) clearly signed with use cases?'),
                )),
            ),
        },
    },
    {
        'name': 'Milwaukee',
        'description': 'Milwaukee power tools, hand tools, and M18/M12 battery system accessories.',
        'icon_name': 'drill',
        'category': 'branded',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Product Display', (
                    ('Brand Fixture Condition', 'Are Milwaukee-branded fixtures, endcaps, and signage in good condition?'),
                    ('Key Product Visibility', 'Are flagship and new-release tools prominently displayed with feature callouts?'),
                    ('Combo Kit Merchandising', 'Are combo kits and value bundles displayed with clear savings messaging?'),
                    ('Security & Accessibility', 'Are high-value tools secured while still being accessible for customer inspection?'),
                )),
                ('Battery/Accessory Organization', (
                    ('M18/M12 Platform Clarity', 'Is the M18 vs. M12 battery platform distinction clearly communicated?'),
                    ('Battery & Charger Stock', 'Are batteries and chargers of various capacities well-stocked?'),
                    ('Accessory Cross-Merchandising', 'Are drill bits, blades, and accessories merchandised near compatible tools?'),
                    ('Replacement Parts Availability', 'Are commonly needed replacement parts and consumables easy to find?'),
                )),
            ),
        },
    },

    # ── Specialty ─────────────────────────────────────────────────────
    {
        'name': 'Firearms',
        'description': 'Firearms, ammunition, and related accessories (where permitted by law).',
        'icon_name': 'shield',
        'category': 'specialty',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Security Compliance', (
                    ('Locked Display Cases', 'Are all firearms stored in locked cases meeting ATF and state requirements?'),
                    ('Access Control', 'Is access to firearms restricted to authorized and trained staff only?'),
                    ('Alarm & Surveillance', 'Are security cameras and alarm systems operational in the firearms area?'),
                )),
                ('Display Cases', (
                    ('Case Cleanliness', 'Are display cases clean, well-lit, and free of smudges or dust?'),
                    ('Product Organization', 'Are firearms organized logically by type (handgun, rifle, shotgun)?'),
                    ('Pricing & Spec Cards', 'Does each firearm have a visible spec card with pricing and caliber information?'),
                )),
                ('Documentation', (
                    ('4473 Form Availability', 'Are ATF Form 4473s readily available and stored securely?'),
                    ('Bound Book Currency', 'Is the A&D (Acquisition & Disposition) bound book up to date?'),
                    ('License Display', 'Is the current FFL displayed in a visible location as required?'),
                )),
                ('Safety Signage', (
                    ('Handling Rules Posted', 'Are firearm safety rules prominently posted in the department?'),
                    ('Age Restriction Signage', 'Are federal and state age-restriction signs clearly displayed?'),
                    ('Storage Safety Info', 'Are safe-storage brochures and trigger-lock information available to customers?'),
                )),
            ),
        },
    },
    {
        'name': 'Key/Lock',
        'description': 'Key cutting, lock sales, and locksmith services.',
        'icon_name': 'key',
        'category': 'specialty',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Key Machine Area', (
                    ('Machine Condition', 'Are key-cutting machines clean, calibrated, and in working order?'),
                    ('Blank Key Stock', 'Is a comprehensive range of key blanks available and organized by type?'),
                    ('Staff Competency Signage', 'Is it clear which staff members are trained to operate the key machine?'),
                )),
                ('Display Organization', (
                    ('Lock Categorization', 'Are locks organized by type (padlock, deadbolt, knob, smart lock)?'),
                    ('Security Rating Visibility', 'Are ANSI/BHMA security grades displayed for each lock product?'),
                    ('Keyed-Alike Options', 'Are keyed-alike sets and re-key kits clearly identified and explained?'),
                )),
                ('Service Counter', (
                    ('Wait Time Communication', 'Is average key-cutting wait time communicated to customers?'),
                    ('Service Menu', 'Is a service menu posted listing key types cut and associated prices?'),
                    ('Workspace Cleanliness', 'Is the service counter clean, organized, and free of metal shavings?'),
                )),
            ),
        },
    },
    {
        'name': 'Rental',
        'description': 'Tool and equipment rental services for contractors and DIY customers.',
        'icon_name': 'clock',
        'category': 'specialty',
        'industry': 'hardware',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Equipment Condition', (
                    ('Operational Readiness', 'Are rental units cleaned, fueled/charged, and tested between rentals?'),
                    ('Maintenance Records', 'Are maintenance logs current for each piece of rental equipment?'),
                    ('Safety Inspection Tags', 'Does each unit have a visible inspection tag with the last service date?'),
                )),
                ('Return Processing Area', (
                    ('Inspection Workflow', 'Is there a clear process and designated area for inspecting returned equipment?'),
                    ('Cleaning Station', 'Are cleaning supplies and a wash-down area available for returns?'),
                    ('Damage Documentation', 'Is there a system for documenting and photographing damage upon return?'),
                )),
                ('Documentation', (
                    ('Rental Agreement Availability', 'Are rental agreement forms or digital contracts readily available?'),
                    ('Rate Sheet Visibility', 'Are rental rates (hourly, daily, weekly) clearly posted and up to date?'),
                    ('Insurance & Liability Info', 'Is damage-waiver and liability information clearly communicated to renters?'),
                    ('ID & Deposit Requirements', 'Are ID and deposit requirements posted visibly at the rental counter?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROCERY
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Produce',
        'description': 'Fresh fruits, vegetables, and organic produce displays.',
        'icon_name': 'apple',
        'category': 'standard',
        'industry': 'grocery',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Freshness', (
                    ('Product Quality', 'Are displayed items free of bruising, wilting, and spoilage?'),
                    ('Rotation Practices', 'Is older product rotated to the front with fresh stock behind?'),
                    ('Misting & Hydration', 'Are misting systems working and leafy greens properly hydrated?'),
                )),
                ('Organization', (
                    ('Category Layout', 'Are items grouped logically (e.g., leafy greens, root vegetables, tropical fruit)?'),
                    ('Signage & Pricing', 'Are price signs accurate, legible, and placed with the correct items?'),
                    ('Organic Separation', 'Are organic items clearly separated and labeled from conventional?'),
                )),
                ('Temperature Compliance', (
                    ('Cold Case Temps', 'Are refrigerated cases maintaining proper temperature ranges?'),
                    ('Ambient Display Temps', 'Are room-temperature displays away from heat sources and direct sunlight?'),
                    ('Temperature Logging', 'Are temperature logs up to date and within acceptable ranges?'),
                )),
            ),
        },
    },
    {
        'name': 'Deli / Bakery',
        'description': 'Deli meats, cheeses, prepared foods, and fresh baked goods.',
        'icon_name': 'cake',
        'category': 'standard',
        'industry': 'grocery',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Case Presentation', (
                    ('Display Attractiveness', 'Are deli cases visually appealing with products arranged neatly?'),
                    ('Product Variety', 'Is there an adequate selection of meats, cheeses, and prepared items?'),
                    ('Glass & Surface Cleanliness', 'Are case glass, trays, and surfaces clean and smudge-free?'),
                )),
                ('Food Safety', (
                    ('Glove & Utensil Usage', 'Are staff using proper gloves and utensils when handling food?'),
                    ('Temperature Monitoring', 'Are hot and cold holding temperatures within safe ranges?'),
                    ('Cross-Contamination Prevention', 'Are raw and ready-to-eat items properly separated?'),
                )),
                ('Product Labeling', (
                    ('Ingredient & Allergen Info', 'Are ingredient lists and allergen warnings displayed for prepared items?'),
                    ('Date Labels', 'Are use-by and prepared-on dates clearly marked on all items?'),
                    ('Pricing Accuracy', 'Are per-pound and per-item prices clearly displayed and accurate?'),
                )),
            ),
        },
    },
    {
        'name': 'Meat / Seafood',
        'description': 'Fresh meat, poultry, and seafood counter and self-service cases.',
        'icon_name': 'drumstick',
        'category': 'standard',
        'industry': 'grocery',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Case Cleanliness', (
                    ('Display Case Condition', 'Are cases clean, free of blood residue, and properly drained?'),
                    ('Ice Bed Freshness', 'Is the seafood ice bed fresh, level, and free of discoloration?'),
                    ('Surrounding Area', 'Are floors, walls, and countertops around cases clean and sanitary?'),
                )),
                ('Temperature Logs', (
                    ('Case Temperature', 'Are display case temperatures within required cold-holding ranges?'),
                    ('Storage Temperature', 'Are walk-in cooler and freezer temps logged and compliant?'),
                    ('Thermometer Visibility', 'Are thermometers visible and functioning in all cases?'),
                )),
                ('Product Dating', (
                    ('Sell-By Dates', 'Are all products within their sell-by dates?'),
                    ('FIFO Rotation', 'Is first-in-first-out rotation consistently followed?'),
                    ('Markdown Timeliness', 'Are approaching-date items marked down or removed promptly?'),
                )),
            ),
        },
    },
    {
        'name': 'Dairy / Frozen',
        'description': 'Dairy products, frozen foods, and refrigerated/freezer aisles.',
        'icon_name': 'snowflake',
        'category': 'standard',
        'industry': 'grocery',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Temperature Compliance', (
                    ('Cooler Temperature', 'Are dairy coolers maintaining 33-40\u00b0F as required?'),
                    ('Freezer Temperature', 'Are freezer cases maintaining 0\u00b0F or below?'),
                    ('Temperature Logging', 'Are temperature checks documented at required intervals?'),
                )),
                ('Stock Rotation', (
                    ('FIFO Compliance', 'Are newer items placed behind older stock consistently?'),
                    ('Expiry Monitoring', 'Are expired or near-expired products identified and pulled?'),
                    ('Shelf Fullness', 'Are shelves adequately stocked without overcrowding?'),
                )),
                ('Door Seals & Visibility', (
                    ('Door Gasket Condition', 'Are freezer and cooler door gaskets intact and sealing properly?'),
                    ('Glass Cleanliness', 'Are glass doors clean and free of condensation or frost buildup?'),
                    ('Interior Lighting', 'Are case lights working so products are visible through doors?'),
                )),
            ),
        },
    },
    {
        'name': 'Front End / Checkout',
        'description': 'Checkout lanes, registers, and front-end merchandising.',
        'icon_name': 'cash-register',
        'category': 'standard',
        'industry': 'grocery',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Register Area Cleanliness', (
                    ('Belt & Scanner Condition', 'Are conveyor belts and scanners clean and functioning?'),
                    ('Counter Surfaces', 'Are checkout counters free of debris, spills, and clutter?'),
                    ('Bag & Supply Stock', 'Are bags, receipt paper, and supplies adequately stocked?'),
                )),
                ('Impulse Display', (
                    ('Display Condition', 'Are checkout lane displays fully stocked and neatly organized?'),
                    ('Pricing Visibility', 'Are all impulse items clearly priced?'),
                    ('Seasonal Relevance', 'Do impulse displays reflect current promotions or seasons?'),
                )),
                ('Queue Management', (
                    ('Lane Staffing', 'Are enough lanes open to keep wait times reasonable?'),
                    ('Line Signage', 'Are express lane limits and self-checkout instructions clearly posted?'),
                    ('Customer Flow', 'Is the queue layout intuitive and free of bottlenecks?'),
                )),
            ),
        },
    },
    {
        'name': 'Floral',
        'description': 'Fresh flowers, arrangements, plants, and floral accessories.',
        'icon_name': 'flower',
        'category': 'standard',
        'industry': 'grocery',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Freshness', (
                    ('Bloom Quality', 'Are displayed flowers fresh, vibrant, and free of wilting or browning?'),
                    ('Arrangement Presentation', 'Are pre-made arrangements attractive and properly priced?'),
                    ('Dead Stock Removal', 'Are wilted or dead items removed promptly from displays?'),
                )),
                ('Water Maintenance', (
                    ('Bucket Water Clarity', 'Is water in display buckets clean and changed regularly?'),
                    ('Vase & Container Condition', 'Are vases and containers clean and free of algae or residue?'),
                    ('Hydration Practices', 'Are stems freshly cut and properly hydrated?'),
                )),
                ('Seasonal Rotation', (
                    ('Holiday Preparedness', 'Are seasonal arrangements ready well before major holidays?'),
                    ('Variety & Selection', 'Is there a good mix of budget and premium options?'),
                    ('Signage & Pricing', 'Are prices clearly displayed for bouquets and individual stems?'),
                )),
            ),
        },
    },
    {
        'name': 'Beer / Wine / Spirits',
        'description': 'Alcoholic beverages including beer, wine, and spirits displays.',
        'icon_name': 'wine-glass',
        'category': 'standard',
        'industry': 'grocery',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Age-Restriction Compliance', (
                    ('ID Check Signage', 'Are "We Card" or age-verification signs prominently displayed?'),
                    ('Staff Training Evidence', 'Are responsible-beverage-service training certificates current?'),
                    ('POS Age Verification', 'Does the POS system prompt for age verification on alcohol sales?'),
                )),
                ('Display Organization', (
                    ('Category Grouping', 'Are products organized by type (beer, wine, spirits) and subcategory?'),
                    ('Shelf Condition', 'Are shelves clean, properly lit, and free of broken bottles or spills?'),
                    ('Local & Featured Selections', 'Are local, craft, or featured items highlighted with signage?'),
                )),
                ('Stock Levels', (
                    ('Popular Item Availability', 'Are high-demand brands and sizes consistently in stock?'),
                    ('Cooler Stock', 'Are refrigerated beer and wine coolers fully stocked and organized?'),
                    ('Seasonal & Promotional Stock', 'Are seasonal items and promotional displays current and stocked?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # CONVENIENCE STORE
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Food Service / Hot Food',
        'description': 'Hot food programs, roller grills, and prepared food stations.',
        'icon_name': 'utensils',
        'category': 'standard',
        'industry': 'convenience',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Equipment Cleanliness', (
                    ('Roller Grill Condition', 'Is the roller grill clean, free of buildup, and functioning properly?'),
                    ('Warming Case Cleanliness', 'Are warming cases and heat lamps clean and in working order?'),
                    ('Prep Area Sanitation', 'Is the food prep area sanitized and free of debris?'),
                )),
                ('Temperature Compliance', (
                    ('Hot Holding Temps', 'Are hot foods maintained at 140\u00b0F or above?'),
                    ('Cold Holding Temps', 'Are cold grab-and-go items at 41\u00b0F or below?'),
                    ('Temperature Logging', 'Are food temperature checks logged at required intervals?'),
                )),
                ('Product Freshness', (
                    ('Time Labels', 'Are prepared items labeled with preparation time and discard time?'),
                    ('Rotation Compliance', 'Are items discarded when they exceed hold-time limits?'),
                    ('Visual Quality', 'Do food items look fresh and appealing to customers?'),
                )),
            ),
        },
    },
    {
        'name': 'Beverage / Cooler',
        'description': 'Cold beverage coolers, fountain drinks, and coffee stations.',
        'icon_name': 'cup-soda',
        'category': 'standard',
        'industry': 'convenience',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Cooler Temp & Organization', (
                    ('Temperature Compliance', 'Are beverage coolers maintaining proper cold temperatures?'),
                    ('Product Facing', 'Are bottles and cans faced forward with labels visible?'),
                    ('Cooler Cleanliness', 'Are cooler shelves, walls, and floors clean and free of spills?'),
                )),
                ('Planogram Compliance', (
                    ('Brand Placement', 'Are beverages placed according to the current planogram?'),
                    ('New Product Placement', 'Are new or promoted items in designated display positions?'),
                    ('Shelf Tag Accuracy', 'Do shelf tags match the products displayed and show correct prices?'),
                )),
                ('Stock Rotation', (
                    ('FIFO Compliance', 'Are newer beverages placed behind older stock?'),
                    ('Expiry Checks', 'Are expired or near-expired items identified and pulled?'),
                    ('Out-of-Stock Gaps', 'Are empty shelf spaces restocked promptly?'),
                )),
            ),
        },
    },
    {
        'name': 'Front End / Register',
        'description': 'Register counter area, tobacco products, and impulse merchandise.',
        'icon_name': 'cash-register',
        'category': 'standard',
        'industry': 'convenience',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Counter Cleanliness', (
                    ('Counter Surface', 'Is the checkout counter clean, organized, and free of clutter?'),
                    ('Equipment Condition', 'Are registers, card readers, and scanners clean and functional?'),
                    ('Surrounding Area', 'Is the floor and area around the register clean and well-maintained?'),
                )),
                ('Tobacco Compliance', (
                    ('Age Verification Signage', 'Are age-restriction signs for tobacco products prominently displayed?'),
                    ('Product Security', 'Are tobacco products secured and inaccessible to customers without assistance?'),
                    ('ID Verification Process', 'Is staff consistently checking IDs for tobacco purchases?'),
                )),
                ('Impulse Display', (
                    ('Counter Display Stock', 'Are counter-top impulse displays fully stocked and organized?'),
                    ('Pricing Visibility', 'Are all impulse items clearly priced?'),
                    ('Promotional Items', 'Are current promotions visible and correctly signed at the register?'),
                )),
            ),
        },
    },
    {
        'name': 'Forecourt / Fuel',
        'description': 'Fuel pumps, islands, and forecourt area maintenance.',
        'icon_name': 'gas-pump',
        'category': 'standard',
        'industry': 'convenience',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Pump Condition', (
                    ('Pump Appearance', 'Are fuel pumps clean, free of stickers/graffiti, and well-maintained?'),
                    ('Screen & Keypad Function', 'Are pump screens, keypads, and card readers working properly?'),
                    ('Hose & Nozzle Condition', 'Are hoses and nozzles in good condition without leaks or damage?'),
                )),
                ('Safety Signage', (
                    ('Fire Safety Signs', 'Are "No Smoking" and fire safety signs posted at every island?'),
                    ('Emergency Shutoff', 'Is the emergency fuel shutoff clearly labeled and accessible?'),
                    ('Fuel Grade Labeling', 'Are fuel grades and prices clearly displayed on pumps and the main sign?'),
                )),
                ('Island Cleanliness', (
                    ('Surface Condition', 'Are pump islands free of fuel spills, trash, and standing water?'),
                    ('Squeegee & Towel Station', 'Are squeegees, towels, and washer fluid available and maintained?'),
                    ('Trash Receptacles', 'Are trash cans at each island emptied regularly and not overflowing?'),
                )),
            ),
        },
    },
    {
        'name': 'Age-Restricted Products',
        'description': 'Compliance for tobacco, alcohol, lottery, and other age-restricted items.',
        'icon_name': 'id-card',
        'category': 'standard',
        'industry': 'convenience',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('ID Verification Signage', (
                    ('Posted Policies', 'Are age-verification policies posted at all points of sale?'),
                    ('Legal Age Signage', 'Are minimum-age-requirement signs displayed for each product category?'),
                    ('Penalty Warnings', 'Are penalty-for-underage-sales warnings visible to customers and staff?'),
                )),
                ('Compliant Display', (
                    ('Product Accessibility', 'Are age-restricted products behind the counter or in locked displays?'),
                    ('Advertising Compliance', 'Does advertising for restricted products comply with local regulations?'),
                    ('Lottery Display', 'Are lottery products displayed and secured per state requirements?'),
                )),
                ('Training Logs', (
                    ('Staff Training Records', 'Are all current employees trained and certified on age-restriction policies?'),
                    ('Sting Operation Readiness', 'Is staff prepared for compliance sting operations?'),
                    ('Refusal Log', 'Is a refusal log maintained for denied sales?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # RESTAURANT / QSR
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Kitchen / Prep Area',
        'description': 'Kitchen line, food prep stations, and cooking equipment.',
        'icon_name': 'kitchen-set',
        'category': 'standard',
        'industry': 'restaurant',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Sanitation', (
                    ('Surface Cleanliness', 'Are prep surfaces, cutting boards, and counters sanitized between tasks?'),
                    ('Handwash Station', 'Are handwash sinks stocked with soap, towels, and signage?'),
                    ('Floor Condition', 'Are kitchen floors clean, dry, and free of grease or food debris?'),
                )),
                ('Equipment Condition', (
                    ('Cooking Equipment', 'Are ovens, fryers, grills, and other equipment clean and functional?'),
                    ('Refrigeration Units', 'Are reach-in coolers and freezers maintaining proper temps?'),
                    ('Small Equipment', 'Are slicers, mixers, and small appliances clean and stored properly?'),
                )),
                ('Food Storage Compliance', (
                    ('Labeling & Dating', 'Are all stored food items labeled with content and date?'),
                    ('FIFO Rotation', 'Is first-in-first-out rotation consistently practiced?'),
                    ('Proper Storage Height', 'Are items stored off the floor and at proper shelf heights?'),
                )),
            ),
        },
    },
    {
        'name': 'Dining Room',
        'description': 'Guest seating area, tables, and dining room environment.',
        'icon_name': 'chair',
        'category': 'standard',
        'industry': 'restaurant',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Table Cleanliness', (
                    ('Table Surface', 'Are tables clean, sanitized, and free of sticky residue between guests?'),
                    ('Seating Condition', 'Are chairs and booths clean, stable, and in good repair?'),
                    ('Table Setting', 'Are condiments, napkins, and table items clean and fully stocked?'),
                )),
                ('Floor Condition', (
                    ('Floor Cleanliness', 'Are floors swept, mopped, and free of food debris or spills?'),
                    ('Under-Table Areas', 'Are areas under tables and booths free of accumulated debris?'),
                    ('Entry & High-Traffic Areas', 'Are entryway and high-traffic zones clean and slip-free?'),
                )),
                ('Condiment Station', (
                    ('Station Cleanliness', 'Are condiment stations clean and wiped down regularly?'),
                    ('Supply Levels', 'Are condiments, napkins, straws, and lids fully stocked?'),
                    ('Organization', 'Are items logically arranged and easy for guests to find?'),
                )),
            ),
        },
    },
    {
        'name': 'Drive-Through',
        'description': 'Drive-through lane, menu boards, and service window.',
        'icon_name': 'car',
        'category': 'standard',
        'industry': 'restaurant',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Menu Board Condition', (
                    ('Visibility & Readability', 'Are menu boards clean, well-lit, and easy to read from the lane?'),
                    ('Pricing Accuracy', 'Are displayed prices current and matching POS prices?'),
                    ('Promotional Panels', 'Are promotional items and limited-time offers displayed correctly?'),
                )),
                ('Speaker & Screen Functionality', (
                    ('Speaker Clarity', 'Is the order speaker clear and functional from a vehicle?'),
                    ('Confirmation Screen', 'Is the order confirmation screen working and displaying correctly?'),
                    ('Two-Way Communication', 'Can staff and guests communicate clearly through the system?'),
                )),
                ('Lane Cleanliness', (
                    ('Lane Surface', 'Is the drive-through lane free of litter, debris, and potholes?'),
                    ('Window Area', 'Are service windows clean and the handoff area organized?'),
                    ('Signage & Directional', 'Are lane markings, directional arrows, and height clearance signs in place?'),
                )),
            ),
        },
    },
    {
        'name': 'Restrooms',
        'description': 'Customer and employee restroom facilities.',
        'icon_name': 'restroom',
        'category': 'standard',
        'industry': 'restaurant',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Cleanliness', (
                    ('Surface Sanitation', 'Are sinks, counters, and fixtures clean and sanitized?'),
                    ('Floor Condition', 'Are floors clean, dry, and free of debris or standing water?'),
                    ('Toilet & Urinal Condition', 'Are toilets and urinals clean, flushing properly, and odor-free?'),
                )),
                ('Supply Levels', (
                    ('Soap Dispensers', 'Are soap dispensers full and functioning?'),
                    ('Paper Products', 'Are toilet paper, paper towels, and seat covers stocked?'),
                    ('Hand Dryers', 'Are electric hand dryers working properly (if applicable)?'),
                )),
                ('Fixture Condition', (
                    ('Faucets & Handles', 'Are faucets and handles working properly without leaks?'),
                    ('Mirror & Lighting', 'Are mirrors clean and lighting adequate?'),
                    ('Door & Lock Function', 'Are stall doors and locks functioning correctly?'),
                )),
            ),
        },
    },
    {
        'name': 'Front Counter / POS',
        'description': 'Front counter service area, POS stations, and order displays.',
        'icon_name': 'cash-register',
        'category': 'standard',
        'industry': 'restaurant',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Cleanliness', (
                    ('Counter Surface', 'Is the front counter clean, organized, and free of clutter?'),
                    ('Menu Board Condition', 'Are overhead or counter menus clean, lit, and up to date?'),
                    ('Display Case', 'Are food display cases (if present) clean and attractively merchandised?'),
                )),
                ('Menu Pricing Accuracy', (
                    ('Price Consistency', 'Do displayed prices match POS system prices?'),
                    ('Combo & Value Meals', 'Are combo meals and value options clearly communicated?'),
                    ('Allergen Information', 'Is allergen and nutritional information available upon request?'),
                )),
                ('Upsell Signage', (
                    ('Promotional Materials', 'Are upsell and promotional signs current and well-placed?'),
                    ('Seasonal Items', 'Are limited-time and seasonal items prominently featured?'),
                    ('Suggestive Selling Cues', 'Are visual cues in place to support suggestive selling?'),
                )),
            ),
        },
    },
    {
        'name': 'Walk-In / Storage',
        'description': 'Walk-in coolers, freezers, and dry storage areas.',
        'icon_name': 'warehouse',
        'category': 'standard',
        'industry': 'restaurant',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Temperature Logs', (
                    ('Cooler Temperature', 'Is the walk-in cooler maintaining 36-40\u00b0F?'),
                    ('Freezer Temperature', 'Is the walk-in freezer maintaining 0\u00b0F or below?'),
                    ('Logging Frequency', 'Are temperature checks logged at least twice daily?'),
                )),
                ('FIFO Rotation', (
                    ('Date Labeling', 'Are all items labeled with received date and use-by date?'),
                    ('Rotation Practice', 'Are newer items stored behind older items consistently?'),
                    ('Expired Product Removal', 'Are expired items identified and removed promptly?'),
                )),
                ('Shelf Organization', (
                    ('Shelf Cleanliness', 'Are shelves and floor areas clean and free of spills?'),
                    ('Proper Storage Separation', 'Are raw meats stored below ready-to-eat items?'),
                    ('Off-Floor Storage', 'Are all items stored at least 6 inches off the floor?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # GENERAL RETAIL
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Apparel / Clothing',
        'description': 'Clothing racks, displays, and apparel merchandising.',
        'icon_name': 'shirt',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Rack Organization', (
                    ('Hanger Consistency', 'Are garments on matching hangers facing the same direction?'),
                    ('Category Grouping', 'Are items grouped logically by style, color, or collection?'),
                    ('Rack Spacing', 'Are racks spaced for easy browsing without overcrowding?'),
                )),
                ('Sizing Accuracy', (
                    ('Size Marker Placement', 'Are size dividers or markers placed correctly on racks?'),
                    ('Size Label Visibility', 'Are folded items showing size labels clearly?'),
                    ('Size Availability', 'Is a reasonable range of sizes available for displayed styles?'),
                )),
                ('Fitting Room Condition', (
                    ('Room Cleanliness', 'Are fitting rooms clean, well-lit, and free of abandoned merchandise?'),
                    ('Mirror Condition', 'Are mirrors clean and properly mounted?'),
                    ('Hooks & Seating', 'Are hooks, benches, and seating in good condition?'),
                )),
            ),
        },
    },
    {
        'name': 'Electronics',
        'description': 'Consumer electronics, accessories, and tech product displays.',
        'icon_name': 'laptop',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Functionality', (
                    ('Demo Unit Operation', 'Are demo devices powered on, charged, and functioning properly?'),
                    ('Display Cleanliness', 'Are screens, surfaces, and display fixtures clean and smudge-free?'),
                    ('Cable & Cord Management', 'Are power and security cables neatly managed and not tangled?'),
                )),
                ('Security Compliance', (
                    ('Anti-Theft Devices', 'Are security tags and tethers properly attached to merchandise?'),
                    ('Locked Case Inventory', 'Are high-value items in locked cases with staff assistance available?'),
                    ('Camera Coverage', 'Is the department adequately covered by security cameras?'),
                )),
                ('Pricing Accuracy', (
                    ('Shelf Tag Accuracy', 'Do shelf tags match current prices in the POS system?'),
                    ('Feature & Spec Cards', 'Are spec cards available comparing features of similar products?'),
                    ('Promotional Pricing', 'Are sale prices and promotional offers accurately displayed?'),
                )),
            ),
        },
    },
    {
        'name': 'Home Goods',
        'description': 'Home decor, kitchenware, bedding, and household merchandise.',
        'icon_name': 'couch',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Shelf Organization', (
                    ('Product Grouping', 'Are items grouped by category or room (kitchen, bath, bedroom)?'),
                    ('Shelf Neatness', 'Are shelves tidy with products properly faced and aligned?'),
                    ('End Cap Displays', 'Are end caps attractively merchandised and theme-consistent?'),
                )),
                ('Pricing Visibility', (
                    ('Price Tag Placement', 'Does every item have a visible price tag or shelf label?'),
                    ('Clearance Marking', 'Are clearance items clearly marked and separated?'),
                    ('Multi-Pack Pricing', 'Are set and multi-pack prices clearly communicated?'),
                )),
                ('Seasonal Displays', (
                    ('Timeliness', 'Are seasonal displays set up well before the relevant holiday or season?'),
                    ('Visual Appeal', 'Are seasonal displays attractive and inviting to shoppers?'),
                    ('Post-Season Cleanup', 'Is out-of-season merchandise cleared and marked down promptly?'),
                )),
            ),
        },
    },
    {
        'name': 'Checkout / Front End',
        'description': 'Retail checkout lanes, registers, and front-end merchandising.',
        'icon_name': 'cash-register',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Register Cleanliness', (
                    ('Counter Surface', 'Are checkout counters clean and free of clutter?'),
                    ('Equipment Condition', 'Are registers, scanners, and card readers clean and functional?'),
                    ('Bag & Supply Stock', 'Are bags, receipt paper, and packing supplies stocked?'),
                )),
                ('Impulse Displays', (
                    ('Display Condition', 'Are checkout lane displays fully stocked and organized?'),
                    ('Product Facing', 'Are impulse items properly faced with labels visible?'),
                    ('Pricing Accuracy', 'Are all impulse items correctly priced?'),
                )),
                ('Queue Management', (
                    ('Lane Availability', 'Are enough lanes open to keep wait times reasonable?'),
                    ('Self-Checkout Function', 'Are self-checkout kiosks operational and well-maintained?'),
                    ('Queue Signage', 'Are line-formation and lane-type signs clear and visible?'),
                )),
            ),
        },
    },
    {
        'name': 'Fitting Rooms',
        'description': 'Fitting room area, attendant station, and return-to-floor process.',
        'icon_name': 'door-open',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Cleanliness', (
                    ('Room Cleanliness', 'Are fitting rooms clean, vacuumed, and free of tags or hangers?'),
                    ('Common Area', 'Is the fitting room lobby and waiting area clean and organized?'),
                    ('Trash & Debris', 'Are trash cans emptied and areas free of abandoned merchandise?'),
                )),
                ('Lighting', (
                    ('Room Lighting', 'Is each fitting room well-lit with functioning bulbs?'),
                    ('Mirror Lighting', 'Are mirrors properly lit for accurate customer viewing?'),
                    ('Hallway Lighting', 'Is the hallway and common area adequately lit?'),
                )),
                ('Item Limit Signage', (
                    ('Limit Posting', 'Is the item limit per room clearly posted at the entrance?'),
                    ('Attendant Presence', 'Is an attendant available to manage traffic and count items?'),
                    ('Return Rack', 'Is a return/go-back rack available and regularly cleared?'),
                )),
            ),
        },
    },
    {
        'name': 'Stockroom / Receiving',
        'description': 'Back-of-house stockroom, receiving dock, and inventory staging.',
        'icon_name': 'warehouse',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Organization', (
                    ('Shelf & Bin Labeling', 'Are storage shelves and bins clearly labeled by department or category?'),
                    ('Aisle Accessibility', 'Are aisles clear and wide enough for safe movement and equipment?'),
                    ('Overstock Management', 'Is overstock organized and easy to locate for replenishment?'),
                )),
                ('Safety Compliance', (
                    ('Fire Exit Access', 'Are fire exits and extinguishers unblocked and clearly marked?'),
                    ('Stacking Height Limits', 'Are stacking height limits followed and posted?'),
                    ('PPE Availability', 'Are required safety items (box cutters, gloves, vests) available?'),
                )),
                ('Processing Efficiency', (
                    ('Receiving Turnaround', 'Is incoming merchandise processed and shelved within target time?'),
                    ('Transfer Staging', 'Are transfer and return shipments staged separately and clearly labeled?'),
                    ('Dock Cleanliness', 'Is the receiving dock clean, organized, and free of hazards?'),
                )),
            ),
        },
    },
    {
        'name': 'General Merchandise',
        'description': 'Catch-all aisle evaluation for any merchandise section.',
        'icon_name': 'boxes-stacked',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Shelf Organization', (
                    ('Product Facing', 'Are products properly faced with labels visible to customers?'),
                    ('Category Grouping', 'Are items grouped logically by category or use?'),
                    ('Planogram Compliance', 'Does the shelf layout match the current planogram?'),
                )),
                ('Pricing & Signage', (
                    ('Price Tag Accuracy', 'Do shelf tags match current prices in the POS system?'),
                    ('Promotional Signs', 'Are sale and promotional signs current. correctly placed, and not expired?'),
                    ('Shelf Label Condition', 'Are shelf labels clean, aligned, and free of damage?'),
                )),
                ('Aisle Condition', (
                    ('Floor Cleanliness', 'Is the aisle floor clean, free of debris, and safe for customers?'),
                    ('Lighting', 'Are aisle lights functioning and providing adequate visibility?'),
                    ('End Cap Displays', 'Are end cap displays stocked, attractive, and relevant to current promotions?'),
                )),
            ),
        },
    },
    {
        'name': 'Seasonal / Endcap',
        'description': 'Rotating seasonal and promotional end cap displays.',
        'icon_name': 'calendar-star',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Timeliness', (
                    ('Seasonal Relevance', 'Does the display reflect the current season or upcoming holiday?'),
                    ('Changeover Speed', 'Was the previous seasonal display removed and replaced on schedule?'),
                    ('Clearance Management', 'Are prior-season items marked down and consolidated promptly?'),
                )),
                ('Visual Merchandising', (
                    ('Display Attractiveness', 'Is the display visually appealing and well-constructed?'),
                    ('Product Arrangement', 'Are products arranged neatly with clear sightlines and easy access?'),
                    ('Signage Quality', 'Are display signs professional, on-brand, and free of damage?'),
                )),
                ('Stock & Pricing', (
                    ('Adequate Stock', 'Is the display fully stocked without bare spots or gaps?'),
                    ('Pricing Visibility', 'Does every item on the display have a visible price?'),
                    ('Promotional Accuracy', 'Do promotional prices and offers match the POS and advertised deals?'),
                )),
            ),
        },
    },
    {
        'name': 'Impulse / Checkout Lane',
        'description': 'Small impulse items near registers.',
        'icon_name': 'basket-shopping',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Condition', (
                    ('Fully Stocked', 'Are impulse display racks and shelves fully stocked with no empty hooks or gaps?'),
                    ('Neat Arrangement', 'Are items neatly arranged and properly faced?'),
                    ('Product Variety', 'Is there a good variety of impulse items appealing to different customers?'),
                )),
                ('Pricing', (
                    ('Every Item Priced', 'Does every impulse item have a visible price tag or shelf label?'),
                    ('Promotional Items Signed', 'Are promotional or featured items clearly signed with deal details?'),
                    ('Coupon Displays', 'Are coupon tear-pads or digital coupon signs current and stocked?'),
                )),
                ('Queue Experience', (
                    ('Lane Cleanliness', 'Is the checkout lane clean, free of trash, and presentable?'),
                    ('Customer Flow', 'Is the lane layout designed for smooth customer flow without bottlenecks?'),
                    ('Wait-Time Perception', 'Are there engaging displays or signage that reduce perceived wait time?'),
                )),
            ),
        },
    },
    {
        'name': 'Clearance / Markdowns',
        'description': 'Clearance sections and markdown racks.',
        'icon_name': 'tags',
        'category': 'standard',
        'industry': 'retail',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Organization', (
                    ('Department or Category Sorting', 'Are clearance items sorted by department, category, or type?'),
                    ('Size Organization', 'Are sized items (apparel, shoes) organized by size for easy browsing?'),
                    ('Clear Labeling', 'Are clearance sections clearly labeled so customers can find them easily?'),
                )),
                ('Pricing Accuracy', (
                    ('Original vs Markdown Price', 'Is the original price shown alongside the markdown price on each item?'),
                    ('Consistent Signage', 'Are markdown signs consistent in format and easy to read?'),
                    ('Tag Condition', 'Are price tags securely attached, legible, and not damaged?'),
                )),
                ('Presentation', (
                    ('Neat Not Dumped', 'Are clearance items displayed neatly rather than dumped in bins?'),
                    ('Adequate Space', 'Is there adequate rack or shelf space for the volume of clearance items?'),
                    ('Regular Cleanup', 'Is the clearance area regularly straightened and maintained throughout the day?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # PHARMACY
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Prescription Counter',
        'description': 'Pharmacy prescription counter, consultation, and dispensing area.',
        'icon_name': 'prescription',
        'category': 'standard',
        'industry': 'pharmacy',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Wait-Time Communication', (
                    ('Wait Time Posting', 'Are estimated wait times communicated clearly to customers?'),
                    ('Queue Management', 'Is the pickup queue organized with clear signage for drop-off vs. pickup?'),
                    ('Notification System', 'Is there a system to notify customers when prescriptions are ready?'),
                )),
                ('Privacy Compliance', (
                    ('Consultation Privacy', 'Is there a private or semi-private area for patient consultations?'),
                    ('HIPAA Signage', 'Are HIPAA privacy notices and patient rights posted?'),
                    ('Screen Visibility', 'Are computer screens positioned to prevent patient data from being visible?'),
                )),
                ('Counter Cleanliness', (
                    ('Counter Surface', 'Is the prescription counter clean, organized, and professional?'),
                    ('Dispensing Area', 'Is the dispensing work area organized and free of clutter?'),
                    ('Bag & Label Organization', 'Are filled prescriptions organized and easy to locate for pickup?'),
                )),
            ),
        },
    },
    {
        'name': 'OTC Merchandise',
        'description': 'Over-the-counter medications, vitamins, and health products.',
        'icon_name': 'pills',
        'category': 'standard',
        'industry': 'pharmacy',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Shelf Organization', (
                    ('Category Grouping', 'Are OTC products grouped by condition (cold/flu, pain, digestive)?'),
                    ('Aisle Signage', 'Are aisle markers and category signs clear and accurate?'),
                    ('Product Facing', 'Are products faced forward with labels clearly visible?'),
                )),
                ('Expiry Date Rotation', (
                    ('Date Checking', 'Are products checked regularly for approaching expiration dates?'),
                    ('FIFO Compliance', 'Are newer items placed behind older stock?'),
                    ('Expired Product Removal', 'Are expired products promptly removed from shelves?'),
                )),
                ('Price Accuracy', (
                    ('Shelf Tag Accuracy', 'Do shelf tags match scanned prices and current promotions?'),
                    ('Promotional Pricing', 'Are sale prices and BOGO offers clearly displayed?'),
                    ('Unit Price Display', 'Are unit prices displayed for easy comparison shopping?'),
                )),
            ),
        },
    },
    {
        'name': 'Health & Beauty',
        'description': 'Cosmetics, skincare, hair care, and personal care products.',
        'icon_name': 'sparkles',
        'category': 'standard',
        'industry': 'pharmacy',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Condition', (
                    ('Fixture Cleanliness', 'Are display fixtures, shelves, and gondolas clean and dust-free?'),
                    ('Product Arrangement', 'Are products neatly arranged by brand and subcategory?'),
                    ('Lighting Quality', 'Is the section well-lit to accurately show product colors?'),
                )),
                ('Tester Availability', (
                    ('Tester Condition', 'Are product testers clean, functional, and not expired?'),
                    ('Tester Security', 'Are testers secured to prevent theft while remaining accessible?'),
                    ('Hygiene Supplies', 'Are disposable applicators and sanitizer available at tester stations?'),
                )),
                ('Planogram Compliance', (
                    ('Layout Accuracy', 'Does the shelf layout match the current planogram?'),
                    ('New Product Integration', 'Are new arrivals placed in designated planogram positions?'),
                    ('Discontinued Removal', 'Are discontinued items removed and shelf space reallocated?'),
                )),
            ),
        },
    },
    {
        'name': 'Consultation Area',
        'description': 'Pharmacist consultation space, immunization area, and health services.',
        'icon_name': 'stethoscope',
        'category': 'standard',
        'industry': 'pharmacy',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Privacy', (
                    ('Visual Privacy', 'Is the consultation area shielded from public view and foot traffic?'),
                    ('Audio Privacy', 'Can conversations be held without being overheard by other customers?'),
                    ('Signage', 'Is the consultation area clearly signed and inviting for patients?'),
                )),
                ('Reference Materials', (
                    ('Drug Information Resources', 'Are drug interaction and reference materials readily available?'),
                    ('Patient Education Materials', 'Are brochures and handouts on common conditions available?'),
                    ('Immunization Information', 'Are vaccine schedules and immunization information current?'),
                )),
                ('Seating & Cleanliness', (
                    ('Seating Condition', 'Are chairs and the consultation table clean and in good repair?'),
                    ('Surface Sanitation', 'Are surfaces sanitized between patient consultations?'),
                    ('Supply Readiness', 'Are immunization and screening supplies organized and stocked?'),
                )),
            ),
        },
    },
    {
        'name': 'Drive-Through Window',
        'description': 'Pharmacy drive-through window service and pickup.',
        'icon_name': 'car',
        'category': 'standard',
        'industry': 'pharmacy',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Speaker Clarity', (
                    ('Audio Quality', 'Is the speaker system clear for two-way communication?'),
                    ('Volume Levels', 'Are volume levels appropriate for privacy and audibility?'),
                    ('Backup Communication', 'Is there a backup method if the speaker system fails?'),
                )),
                ('Signage', (
                    ('Hours of Operation', 'Are drive-through hours clearly posted and visible from the lane?'),
                    ('Service Instructions', 'Are instructions for using the drive-through clearly displayed?'),
                    ('Prescription Drop-Off Info', 'Is information about drop-off and pickup procedures posted?'),
                )),
                ('Lane Condition', (
                    ('Lane Surface', 'Is the drive-through lane free of potholes, debris, and standing water?'),
                    ('Window Area', 'Is the service window clean and the handoff area organized?'),
                    ('Lighting', 'Is the drive-through lane adequately lit for nighttime use?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # AUTOMOTIVE
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Service Bay',
        'description': 'Vehicle service bays, lifts, and repair work areas.',
        'icon_name': 'wrench',
        'category': 'standard',
        'industry': 'automotive',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Equipment Condition', (
                    ('Lift Maintenance', 'Are vehicle lifts inspected, certified, and in safe working order?'),
                    ('Tool Organization', 'Are tools organized, clean, and stored in designated locations?'),
                    ('Diagnostic Equipment', 'Are diagnostic machines and scanners functioning and calibrated?'),
                )),
                ('Safety Compliance', (
                    ('Safety Signage', 'Are OSHA-required safety signs posted in visible locations?'),
                    ('Fire Extinguisher Access', 'Are fire extinguishers accessible, inspected, and up to date?'),
                    ('PPE Usage', 'Are technicians using required safety glasses, gloves, and footwear?'),
                )),
                ('Work Area Cleanliness', (
                    ('Floor Condition', 'Are bay floors free of oil spills, coolant, and trip hazards?'),
                    ('Waste Disposal', 'Are used oil, filters, and parts disposed of in proper containers?'),
                    ('Bay Organization', 'Is each bay organized with parts and tools for the current job only?'),
                )),
            ),
        },
    },
    {
        'name': 'Parts Counter',
        'description': 'Auto parts counter, catalog access, and parts inventory.',
        'icon_name': 'gears',
        'category': 'standard',
        'industry': 'automotive',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Organization', (
                    ('Counter Cleanliness', 'Is the parts counter clean, organized, and professional?'),
                    ('Display Condition', 'Are featured parts and accessories neatly displayed?'),
                    ('Signage', 'Are department hours, services, and pricing clearly posted?'),
                )),
                ('Catalog Access', (
                    ('Digital Catalog', 'Are electronic parts catalogs functional and up to date?'),
                    ('Lookup Speed', 'Can staff quickly look up parts by vehicle year/make/model?'),
                    ('Cross-Reference Materials', 'Are cross-reference guides available for common part numbers?'),
                )),
                ('Stock Availability', (
                    ('Common Parts Stock', 'Are frequently requested parts (filters, belts, brakes) in stock?'),
                    ('Special Order Process', 'Is the special-order process clearly communicated with timeline estimates?'),
                    ('Inventory Accuracy', 'Does system inventory match actual shelf stock?'),
                )),
            ),
        },
    },
    {
        'name': 'Waiting Area / Lobby',
        'description': 'Customer waiting area, lobby, and service advisor stations.',
        'icon_name': 'couch',
        'category': 'standard',
        'industry': 'automotive',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Seating Cleanliness', (
                    ('Seat Condition', 'Are chairs and seating clean, comfortable, and in good repair?'),
                    ('Floor & Surface Cleanliness', 'Are floors, tables, and surfaces clean and well-maintained?'),
                    ('Restroom Condition', 'Are customer restrooms clean, stocked, and functional?'),
                )),
                ('Amenities', (
                    ('Beverage Station', 'Are coffee, water, or beverage options available and maintained?'),
                    ('Wi-Fi & Entertainment', 'Is Wi-Fi available and are TVs or magazines provided?'),
                    ('Charging Stations', 'Are phone/device charging options available for waiting customers?'),
                )),
                ('Information Displays', (
                    ('Service Menu & Pricing', 'Are service offerings and pricing clearly displayed?'),
                    ('Status Updates', 'Are customers kept informed about their vehicle\'s service progress?'),
                    ('Certifications & Licenses', 'Are ASE certifications and business licenses displayed?'),
                )),
            ),
        },
    },
    {
        'name': 'Tire Display',
        'description': 'Tire showroom, display racks, and tire service information.',
        'icon_name': 'circle',
        'category': 'standard',
        'industry': 'automotive',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Organization by Size', (
                    ('Size Grouping', 'Are tires organized by size, brand, or vehicle type?'),
                    ('Display Rack Condition', 'Are tire display racks stable, clean, and well-maintained?'),
                    ('Searchability', 'Can customers easily find tires for their vehicle?'),
                )),
                ('Pricing Visibility', (
                    ('Price Tags', 'Does each displayed tire have a visible price and size tag?'),
                    ('Package Pricing', 'Are buy-4 pricing and installation packages clearly shown?'),
                    ('Comparison Information', 'Are tire comparison charts (treadwear, warranty, performance) available?'),
                )),
                ('Condition', (
                    ('Display Tire Cleanliness', 'Are display tires clean and dressed for a professional appearance?'),
                    ('Sample Tread Demos', 'Are tread-depth gauges or wear indicators available for demonstration?'),
                    ('Warranty Information', 'Is warranty and road-hazard coverage information readily available?'),
                )),
            ),
        },
    },
    {
        'name': 'Fluid / Chemical Storage',
        'description': 'Automotive fluids, chemicals, and hazardous material storage.',
        'icon_name': 'flask',
        'category': 'standard',
        'industry': 'automotive',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('OSHA Compliance', (
                    ('SDS Availability', 'Are Safety Data Sheets readily accessible for all stored chemicals?'),
                    ('Ventilation', 'Is the storage area properly ventilated per OSHA requirements?'),
                    ('Signage', 'Are hazard warning signs and labels posted appropriately?'),
                )),
                ('Labeling', (
                    ('Container Labels', 'Are all containers clearly labeled with contents and hazard info?'),
                    ('Secondary Containers', 'Are secondary/transfer containers labeled per OSHA standards?'),
                    ('Expiry Dates', 'Are products within their shelf life and expired items removed?'),
                )),
                ('Spill Containment', (
                    ('Spill Kit Availability', 'Are spill kits stocked and accessible near storage areas?'),
                    ('Containment Systems', 'Are containment pallets or berms in place for liquid storage?'),
                    ('Drain Protection', 'Are floor drains protected from chemical or oil contamination?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # FITNESS / GYM
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Cardio Floor',
        'description': 'Cardio equipment area including treadmills, bikes, and ellipticals.',
        'icon_name': 'heartbeat',
        'category': 'standard',
        'industry': 'fitness',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Equipment Condition', (
                    ('Machine Functionality', 'Are all cardio machines powered on, functional, and calibrated?'),
                    ('Wear & Tear', 'Are belts, pedals, seats, and handles free of excessive wear?'),
                    ('Out-of-Order Signage', 'Are broken machines clearly marked and reported for repair?'),
                )),
                ('Cleaning Supplies', (
                    ('Wipe Station Access', 'Are cleaning wipe dispensers stocked and within reach of every machine?'),
                    ('Spray & Towel Availability', 'Are spray bottles and towels available as an alternative?'),
                    ('Usage Signage', 'Are "Please wipe down after use" signs posted visibly?'),
                )),
                ('Spacing & Flow', (
                    ('Machine Spacing', 'Is there adequate space between machines for safe use and access?'),
                    ('Traffic Flow', 'Can members move through the cardio area without navigating obstacles?'),
                    ('Ventilation & Temperature', 'Is the cardio area well-ventilated and at a comfortable temperature?'),
                )),
            ),
        },
    },
    {
        'name': 'Free Weights / Strength',
        'description': 'Free weight area, weight machines, and strength training equipment.',
        'icon_name': 'dumbbell',
        'category': 'standard',
        'industry': 'fitness',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Rack Organization', (
                    ('Weight Placement', 'Are dumbbells and plates returned to the correct rack positions?'),
                    ('Rack Labeling', 'Are racks clearly labeled by weight for easy identification?'),
                    ('Bar & Accessory Storage', 'Are barbells, curl bars, and accessories stored properly?'),
                )),
                ('Equipment Condition', (
                    ('Bench Condition', 'Are bench pads clean, intact, and free of tears?'),
                    ('Cable Machine Function', 'Are cable machines, pulleys, and attachments working smoothly?'),
                    ('Plate & Dumbbell Condition', 'Are weights free of damage, rust, and sharp edges?'),
                )),
                ('Safety Mirrors', (
                    ('Mirror Cleanliness', 'Are wall mirrors clean and free of smudges or cracks?'),
                    ('Mirror Coverage', 'Do mirrors adequately cover lifting areas for form checks?'),
                    ('Secure Mounting', 'Are mirrors securely mounted and free of looseness?'),
                )),
            ),
        },
    },
    {
        'name': 'Group Fitness Studios',
        'description': 'Group exercise studios for classes like yoga, cycling, and HIIT.',
        'icon_name': 'users',
        'category': 'standard',
        'industry': 'fitness',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Floor Cleanliness', (
                    ('Floor Surface', 'Are studio floors clean, dry, and free of debris?'),
                    ('Mat Area', 'Are floor mats clean and in good condition?'),
                    ('Post-Class Cleanup', 'Is the studio cleaned and reset between classes?'),
                )),
                ('Equipment Storage', (
                    ('Storage Organization', 'Are mats, weights, bands, and props stored neatly after class?'),
                    ('Equipment Condition', 'Are class props and equipment in good condition and not worn out?'),
                    ('Inventory Levels', 'Are there enough mats, weights, and props for a full class?'),
                )),
                ('Schedule Display', (
                    ('Posted Schedule', 'Is the class schedule posted visibly outside the studio?'),
                    ('Schedule Accuracy', 'Does the posted schedule match the online/app schedule?'),
                    ('Instructor Information', 'Are instructor names and class descriptions available?'),
                )),
            ),
        },
    },
    {
        'name': 'Locker Rooms',
        'description': 'Locker rooms, showers, and changing facilities.',
        'icon_name': 'locker',
        'category': 'standard',
        'industry': 'fitness',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Cleanliness', (
                    ('Floor Condition', 'Are floors clean, dry where possible, and free of hair and debris?'),
                    ('Shower Condition', 'Are showers clean, mold-free, and draining properly?'),
                    ('Sink & Vanity Area', 'Are sinks, mirrors, and vanity areas clean and functional?'),
                )),
                ('Supply Levels', (
                    ('Soap & Shampoo', 'Are soap and shampoo dispensers filled and functioning?'),
                    ('Paper Products', 'Are paper towels, toilet paper, and tissues stocked?'),
                    ('Amenities', 'Are hair dryers, lotion, and other amenities available and working?'),
                )),
                ('Fixture Condition', (
                    ('Locker Function', 'Are lockers functioning with working locks and doors?'),
                    ('Bench Condition', 'Are benches clean, stable, and in good repair?'),
                    ('Ventilation', 'Is the locker room well-ventilated and free of strong odors?'),
                )),
            ),
        },
    },
    {
        'name': 'Front Desk / Check-in',
        'description': 'Gym front desk, check-in stations, and retail display.',
        'icon_name': 'desktop',
        'category': 'standard',
        'industry': 'fitness',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Greeting', (
                    ('Staff Presence', 'Is the front desk staffed and ready to greet members?'),
                    ('Check-in Process', 'Is the check-in process smooth and efficient?'),
                    ('Guest & Visitor Handling', 'Are guest passes and visitor procedures clearly communicated?'),
                )),
                ('System Functionality', (
                    ('Check-in System', 'Are scanners, kiosks, or check-in systems functioning properly?'),
                    ('Membership Lookup', 'Can staff quickly look up membership information?'),
                    ('Emergency Contacts', 'Are emergency contact procedures and AED locations posted?'),
                )),
                ('Retail Display', (
                    ('Merchandise Presentation', 'Are retail items (drinks, supplements, gear) neatly displayed?'),
                    ('Pricing Visibility', 'Are all retail items clearly priced?'),
                    ('Stock Levels', 'Are popular items (water, protein bars, towels) in stock?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # HOSPITALITY / HOTEL
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Front Desk / Lobby',
        'description': 'Hotel front desk, lobby area, and guest check-in experience.',
        'icon_name': 'bell-concierge',
        'category': 'standard',
        'industry': 'hospitality',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Cleanliness', (
                    ('Lobby Floor & Surfaces', 'Are lobby floors, furniture, and surfaces clean and well-maintained?'),
                    ('Front Desk Area', 'Is the front desk counter clean, organized, and professional?'),
                    ('Restroom Condition', 'Are lobby restrooms clean, stocked, and presentable?'),
                )),
                ('Staff Presentation', (
                    ('Uniform & Grooming', 'Are front desk staff in clean uniforms with professional grooming?'),
                    ('Greeting & Attitude', 'Are guests greeted promptly and warmly upon arrival?'),
                    ('Name Badge Visibility', 'Are staff name badges visible and professional?'),
                )),
                ('Information Display', (
                    ('Local Information', 'Are maps, brochures, and local attraction info available?'),
                    ('Hotel Amenity Signage', 'Are hotel amenities (pool hours, breakfast, Wi-Fi) clearly posted?'),
                    ('Event & Meeting Board', 'Is the event or meeting schedule board current and accurate?'),
                )),
            ),
        },
    },
    {
        'name': 'Guest Rooms',
        'description': 'Guest room condition, amenities, and housekeeping standards.',
        'icon_name': 'bed',
        'category': 'standard',
        'industry': 'hospitality',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Linen Condition', (
                    ('Bed Making Quality', 'Are beds properly made with crisp, wrinkle-free linens?'),
                    ('Linen Freshness', 'Are sheets, pillowcases, and towels fresh and stain-free?'),
                    ('Pillow & Blanket Supply', 'Are extra pillows and blankets available per brand standards?'),
                )),
                ('Amenity Stocking', (
                    ('Bathroom Amenities', 'Are soap, shampoo, conditioner, and lotion fully stocked?'),
                    ('Beverage Station', 'Are coffee, tea, and cups/glasses clean and stocked?'),
                    ('In-Room Technology', 'Are TV, remote, alarm clock, and charging ports functional?'),
                )),
                ('Fixture Functionality', (
                    ('Lighting', 'Are all room lights, reading lamps, and switches working?'),
                    ('HVAC & Climate', 'Is the thermostat functional and the room at a comfortable temperature?'),
                    ('Plumbing', 'Are faucets, shower, and toilet functioning properly without leaks?'),
                )),
            ),
        },
    },
    {
        'name': 'Housekeeping',
        'description': 'Housekeeping operations, cart organization, and inspection standards.',
        'icon_name': 'broom',
        'category': 'standard',
        'industry': 'hospitality',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Cart Organization', (
                    ('Cart Neatness', 'Are housekeeping carts neat, organized, and presentable?'),
                    ('Supply Stock', 'Are carts fully stocked with linens, amenities, and cleaning supplies?'),
                    ('Chemical Storage', 'Are cleaning chemicals properly labeled and stored on the cart?'),
                )),
                ('Supply Management', (
                    ('Linen Inventory', 'Are linen closets organized and adequately stocked?'),
                    ('Chemical Inventory', 'Are cleaning chemical supplies monitored and reordered on time?'),
                    ('Equipment Condition', 'Are vacuums, mops, and cleaning equipment in good working order?'),
                )),
                ('Inspection Logs', (
                    ('Room Inspection Records', 'Are room inspection checklists completed for each cleaned room?'),
                    ('Supervisor Sign-Off', 'Are supervisor spot-check inspections documented?'),
                    ('Guest Request Tracking', 'Are special guest requests tracked and fulfilled?'),
                )),
            ),
        },
    },
    {
        'name': 'Pool / Fitness Center',
        'description': 'Hotel pool area, fitness center, and recreational facilities.',
        'icon_name': 'swimming-pool',
        'category': 'standard',
        'industry': 'hospitality',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Safety Signage', (
                    ('Pool Rules Posted', 'Are pool rules, depth markers, and "No Lifeguard" signs posted?'),
                    ('Emergency Equipment', 'Are life rings, first aid kits, and emergency phones accessible?'),
                    ('Hours of Operation', 'Are pool and fitness center hours clearly posted?'),
                )),
                ('Equipment Condition', (
                    ('Fitness Equipment', 'Are fitness machines functioning and in good condition?'),
                    ('Pool Furniture', 'Are lounge chairs, tables, and umbrellas clean and in good repair?'),
                    ('Towel Availability', 'Are clean pool towels readily available for guests?'),
                )),
                ('Cleanliness', (
                    ('Pool Water Clarity', 'Is the pool water clear, properly treated, and chemically balanced?'),
                    ('Deck Condition', 'Is the pool deck clean, free of debris, and non-slippery?'),
                    ('Fitness Center Cleanliness', 'Are fitness center floors, mirrors, and equipment clean?'),
                )),
            ),
        },
    },
    {
        'name': 'Meeting / Event Space',
        'description': 'Conference rooms, ballrooms, and event spaces.',
        'icon_name': 'presentation',
        'category': 'standard',
        'industry': 'hospitality',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('AV Equipment', (
                    ('Projector & Screen', 'Are projectors, screens, and displays functioning and clean?'),
                    ('Sound System', 'Are microphones, speakers, and audio systems working properly?'),
                    ('Connectivity', 'Are HDMI, Wi-Fi, and video conferencing tools functional and accessible?'),
                )),
                ('Setup Condition', (
                    ('Table & Chair Setup', 'Are tables and chairs arranged according to the event layout?'),
                    ('Linen & Place Setting', 'Are tablecloths, place settings, and centerpieces in good condition?'),
                    ('Temperature & Lighting', 'Are room temperature and lighting set appropriately for the event?'),
                )),
                ('Cleanliness', (
                    ('Floor Condition', 'Are carpets or floors clean, vacuumed, and stain-free?'),
                    ('Surface Cleanliness', 'Are tables, podiums, and surfaces dust-free and polished?'),
                    ('Restroom Proximity', 'Are nearby restrooms clean and stocked for event attendees?'),
                )),
            ),
        },
    },

    # ══════════════════════════════════════════════════════════════════════
    # DISCOUNT / VARIETY
    # ══════════════════════════════════════════════════════════════════════
    {
        'name': 'Party Supplies',
        'description': 'Balloons, plates, decorations, gift bags.',
        'icon_name': 'party-horn',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Organization', (
                    ('Product Grouping', 'Are party supplies grouped by theme, color, or event type?'),
                    ('Helium Tank Area', 'Is the helium tank area clean, accessible, and clearly signed?'),
                    ('Seasonal Themes', 'Are current seasonal and holiday party themes prominently displayed?'),
                )),
                ('Stock Levels', (
                    ('Popular Items', 'Are high-demand items like solid-color plates and balloons fully stocked?'),
                    ('Color Variety', 'Is there a good selection of colors available across product types?'),
                    ('Party Sets', 'Are pre-packaged party sets and kits available and well-displayed?'),
                )),
                ('Signage & Pricing', (
                    ('Per-Item Pricing', 'Is per-item or per-pack pricing clearly visible on all products?'),
                    ('Bundle Deals', 'Are bundle or multi-buy deals clearly signed and easy to understand?'),
                    ('Aisle Markers', 'Are aisle markers and category signs helping customers navigate the section?'),
                )),
            ),
        },
    },
    {
        'name': 'Cleaning & Household',
        'description': 'Cleaning products, trash bags, storage solutions.',
        'icon_name': 'spray-can',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Shelf Organization', (
                    ('Category Grouping', 'Are products grouped by category (bathroom, kitchen, laundry, etc.)?'),
                    ('Size Sorting', 'Are products sorted by size within each category for easy comparison?'),
                    ('Brand Placement', 'Are brand sections consistent and easy to identify?'),
                )),
                ('Safety Compliance', (
                    ('Chemical Storage', 'Are chemical products stored upright and away from food items?'),
                    ('Child-Proof Items', 'Are child-safety-cap products properly sealed and on appropriate shelves?'),
                    ('SDS Access', 'Are Safety Data Sheets accessible for all chemical products as required?'),
                )),
                ('Stock Rotation', (
                    ('Expiry Checking', 'Are products with expiration dates checked and within date?'),
                    ('FIFO', 'Is first-in-first-out rotation practiced with older stock in front?'),
                    ('Damaged Item Removal', 'Are leaking, dented, or damaged products promptly removed from shelves?'),
                )),
            ),
        },
    },
    {
        'name': 'Food & Snacks',
        'description': 'Shelf-stable food, candy, beverages.',
        'icon_name': 'cookie',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Date Compliance', (
                    ('Expiry Date Checking', 'Are all products within their sell-by or best-by dates?'),
                    ('FIFO Rotation', 'Is first-in-first-out rotation practiced so oldest stock sells first?'),
                    ('Pull List', 'Are near-expiry items identified and pulled or marked down on schedule?'),
                )),
                ('Display Condition', (
                    ('Product Facing', 'Are products properly faced with labels visible to customers?'),
                    ('Shelf Cleanliness', 'Are shelves clean, free of spills, crumbs, and sticky residue?'),
                    ('Price Tags', 'Does every product have a visible and accurate price tag or shelf label?'),
                )),
                ('Temperature Items', (
                    ('Cooler Temp Compliance', 'Are refrigerated coolers maintaining proper temperature per posted standards?'),
                    ('Cold Beverage Stock', 'Are cold beverages fully stocked and rotated in cooler doors?'),
                    ('Grab-and-Go Items', 'Are grab-and-go snack and drink displays stocked and appealing?'),
                )),
            ),
        },
    },
    {
        'name': 'Health & Beauty',
        'description': 'Personal care, OTC meds, cosmetics.',
        'icon_name': 'heart-pulse',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Shelf Organization', (
                    ('Category Grouping', 'Are products grouped by category (hair care, skin care, oral care, etc.)?'),
                    ('Brand Sections', 'Are brand sections clearly defined and consistent across the aisle?'),
                    ('Planogram Compliance', 'Does the shelf layout match the current planogram or reset guide?'),
                )),
                ('Expiry Management', (
                    ('Date Checking', 'Are products with expiration dates checked and within date?'),
                    ('Rotation', 'Is product rotation practiced with older stock positioned in front?'),
                    ('Damaged or Opened Items', 'Are opened, damaged, or tampered products removed promptly?'),
                )),
                ('Security', (
                    ('High-Theft Items', 'Are frequently stolen items (cosmetics, razors) in secured or monitored displays?'),
                    ('Locked Case Condition', 'Are locked display cases clean, well-lit, and easy for staff to access?'),
                    ('Anti-Theft Tags', 'Are anti-theft tags or spider wraps applied to high-value items?'),
                )),
            ),
        },
    },
    {
        'name': 'Seasonal',
        'description': 'Holiday decor, seasonal merchandise.',
        'icon_name': 'snowflake',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Timeliness', (
                    ('Changeover Timing', 'Was the seasonal changeover completed on or before the target date?'),
                    ('Current Holiday Focus', 'Does the section prominently feature the current or next upcoming holiday?'),
                    ('Clearance of Prior Season', 'Has prior-season merchandise been marked down and consolidated?'),
                )),
                ('Display Appeal', (
                    ('Visual Merchandising', 'Is the seasonal section visually appealing and well-constructed?'),
                    ('Feature Placement', 'Are key seasonal items placed at eye level or in high-traffic areas?'),
                    ('Color Coordination', 'Are displays color-coordinated for a cohesive, attractive look?'),
                )),
                ('Pricing & Signage', (
                    ('Clear Pricing', 'Does every seasonal item have a visible and accurate price?'),
                    ('Promotional Signs', 'Are promotional and sale signs current, professional, and well-placed?'),
                    ('Markdown Accuracy', 'Are markdown prices accurate and consistent across similar items?'),
                )),
            ),
        },
    },
    {
        'name': 'Stationery & Office',
        'description': 'School supplies, office basics, greeting cards.',
        'icon_name': 'pen-ruler',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Organization', (
                    ('Category Grouping', 'Are products grouped by category (writing, paper, filing, cards)?'),
                    ('Size Sorting', 'Are items sorted by size or type within each category?'),
                    ('Brand Sections', 'Are branded sections (e.g., Crayola, BIC) clearly identified?'),
                )),
                ('Stock Levels', (
                    ('Popular Items', 'Are high-demand items like notebooks, pens, and tape fully stocked?'),
                    ('Seasonal School Supply', 'Are back-to-school and seasonal supplies stocked ahead of demand?'),
                    ('Test Products', 'Are pen and marker testers available and functional where provided?'),
                )),
                ('Display Condition', (
                    ('Peg Hook Condition', 'Are peg hooks straight, secure, and properly labeled?'),
                    ('Shelf Labels', 'Are shelf labels aligned, legible, and matching the products displayed?'),
                    ('Product Facing', 'Are products properly faced with packaging visible to customers?'),
                )),
            ),
        },
    },
    {
        'name': 'Toys & Games',
        'description': 'Kids toys, puzzles, activity books.',
        'icon_name': 'puzzle-piece',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Safety', (
                    ('Age Labeling', 'Are age-recommendation labels visible on all toy packaging?'),
                    ('Damaged Packaging', 'Are items with damaged or opened packaging removed or marked down?'),
                    ('Small Parts Warnings', 'Are choking-hazard and small-parts warnings visible where required?'),
                )),
                ('Organization', (
                    ('Age Grouping', 'Are toys grouped by age range for easy browsing by parents?'),
                    ('Category Sorting', 'Are items sorted by type (dolls, action figures, puzzles, etc.)?'),
                    ('Feature Displays', 'Are new arrivals and popular items featured prominently?'),
                )),
                ('Stock & Pricing', (
                    ('Popular Items', 'Are best-selling and trending toys fully stocked?'),
                    ('Price Tag Placement', 'Does every item have a visible price tag or shelf label?'),
                    ('Impulse Items', 'Are small impulse toys stocked near checkout or aisle ends?'),
                )),
            ),
        },
    },
    {
        'name': 'Home Decor',
        'description': 'Frames, candles, artificial flowers, wall art.',
        'icon_name': 'image',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Display Presentation', (
                    ('Visual Grouping', 'Are decor items grouped by style, color, or room theme?'),
                    ('Color Coordination', 'Are displays color-coordinated for an attractive presentation?'),
                    ('Breakable Item Handling', 'Are fragile items (glass, ceramic) displayed securely to prevent breakage?'),
                )),
                ('Shelf Condition', (
                    ('Dust-Free', 'Are shelves and displayed items clean and free of dust?'),
                    ('Stable Displays', 'Are displays stable and secure, with no items at risk of falling?'),
                    ('Price Visibility', 'Are prices visible on all items without needing to pick them up?'),
                )),
                ('Seasonal Rotation', (
                    ('Seasonal Items Featured', 'Are current seasonal decor items featured in prominent positions?'),
                    ('Post-Season Clearance', 'Has prior-season decor been marked down and consolidated?'),
                    ('Trend Items', 'Are trending decor styles and items given feature placement?'),
                )),
            ),
        },
    },
    {
        'name': 'Kitchen & Dining',
        'description': 'Dishes, utensils, food storage, glassware.',
        'icon_name': 'utensils',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Breakable Item Display', (
                    ('Secure Stacking', 'Are dishes and glassware stacked securely to prevent toppling?'),
                    ('Shelf Lips', 'Do shelves have lips or guards to prevent items from sliding off?'),
                    ('Padding', 'Is adequate padding or separation used between fragile stacked items?'),
                )),
                ('Organization', (
                    ('Category Grouping by Use', 'Are items grouped by use (cooking, serving, storage, cleaning)?'),
                    ('Set Displays', 'Are matching sets displayed together with set-price signage?'),
                    ('Size Sorting', 'Are items sorted by size within each category?'),
                )),
                ('Stock & Pricing', (
                    ('Price Tag Visibility', 'Is the price visible on every item or its shelf label?'),
                    ('Set vs Individual Pricing', 'Is it clear whether prices are per-piece or per-set?'),
                    ('Popular Item Stock', 'Are best-selling kitchen items fully stocked?'),
                )),
            ),
        },
    },
    {
        'name': 'Crafts & DIY',
        'description': 'Craft supplies, ribbon, floral, paint.',
        'icon_name': 'scissors',
        'category': 'standard',
        'industry': 'discount',
        'is_active': True,
        'default_structure': {
            'sections': _sections(
                ('Organization', (
                    ('Category Grouping', 'Are craft supplies grouped by category (paint, paper, fabric, floral)?'),
                    ('Project Type Sorting', 'Are items sorted by project type for easy idea browsing?'),
                    ('Accessory Pairing', 'Are complementary accessories merchandised near related supplies?'),
                )),
                ('Display Condition', (
                    ('Pegboard Condition', 'Are pegboard hooks straight, secure, and properly labeled?'),
                    ('Bin Neatness', 'Are bins and baskets neat, sorted, and not overflowing?'),
                    ('Sample Displays', 'Are sample or inspiration displays available and in good condition?'),
                )),
                ('Stock Levels', (
                    ('Popular Supplies', 'Are high-demand supplies (glue, paint, brushes) fully stocked?'),
                    ('Seasonal Craft Items', 'Are seasonal craft items stocked ahead of the relevant holiday?'),
                    ('Hobby Basics', 'Are basic hobby supplies (yarn, beads, markers) consistently available?'),
                )),
            ),
        },
    },
]


class Command(BaseCommand):
    help = 'Seed the platform catalog with all-industry DepartmentType records.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing DepartmentType records before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            count = DepartmentType.objects.count()
            DepartmentType.objects.all().delete()
            self.stdout.write(f'Deleted {count} existing DepartmentType record(s).')
            logger.info('Cleared %d DepartmentType records.', count)

        created = 0
        updated = 0

        for dept_data in DEPARTMENT_TYPES:
            obj, was_created = DepartmentType.objects.update_or_create(
                name=dept_data['name'],
                category=dept_data['category'],
                defaults={
                    'description': dept_data['description'],
                    'icon_name': dept_data['icon_name'],
                    'industry': dept_data['industry'],
                    'default_structure': dept_data['default_structure'],
                    'is_active': dept_data['is_active'],
                },
            )

            if was_created:
                created += 1
                logger.info('Created DepartmentType: %s (%s)', obj.name, obj.category)
            else:
                updated += 1
                logger.info('Updated DepartmentType: %s (%s)', obj.name, obj.category)

        self.stdout.write(self.style.SUCCESS(
            f'Done! Created {created}, updated {updated} DepartmentType record(s).'
        ))
        logger.info(
            'Seeding complete — created %d, updated %d DepartmentType records.',
            created, updated,
        )
