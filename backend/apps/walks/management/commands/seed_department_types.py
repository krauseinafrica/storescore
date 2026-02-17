"""
Seed the platform catalog with hardware-store DepartmentType records.

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
# Standard departments
# ═══════════════════════════════════════════════════════════════════════════

DEPARTMENT_TYPES = [
    # ── Standard ──────────────────────────────────────────────────────
    {
        'name': 'Paint',
        'description': 'Interior and exterior paint, stains, primers, and color-matching services.',
        'icon_name': 'paint-roller',
        'category': 'standard',
        'industry': 'hardware',
        'is_active': True,
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
        'install_count': 0,
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
]


class Command(BaseCommand):
    help = 'Seed the platform catalog with hardware-store DepartmentType records.'

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
                    'install_count': dept_data['install_count'],
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
