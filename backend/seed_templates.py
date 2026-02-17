"""
Seed additional hardware industry templates.
Run via: docker compose exec backend python manage.py shell < seed_templates.py
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.walks.models import IndustryTemplate
from apps.accounts.models import Organization

# Set existing org industry to hardware
Organization.objects.filter(name__icontains='Karnes').update(industry='hardware')

templates_data = [
    {
        'name': 'Endcap Display Evaluation',
        'description': 'Evaluate the quality, merchandising, and compliance of endcap displays throughout the store. Covers product placement, signage, pricing, and seasonal relevance.',
        'industry': 'hardware',
        'is_featured': True,
        'structure': {
            'sections': [
                {
                    'name': 'Endcap Presentation',
                    'weight': 30,
                    'criteria': [
                        {
                            'name': 'Product arrangement is neat and well-organized',
                            'weight': 5,
                            'drivers': ['Products falling over', 'Overcrowded display', 'No logical grouping', 'Mixed categories on display']
                        },
                        {
                            'name': 'Products face forward with labels visible',
                            'weight': 5,
                            'drivers': ['Products turned backwards', 'Labels obscured', 'Inconsistent facing']
                        },
                        {
                            'name': 'Display is fully stocked with no empty spaces',
                            'weight': 5,
                            'drivers': ['Out of stock items', 'Empty hooks/shelves', 'Insufficient replenishment']
                        },
                        {
                            'name': 'Endcap header/topper is present and correct',
                            'weight': 5,
                            'drivers': ['Missing header card', 'Damaged topper', 'Wrong promotional header']
                        },
                    ]
                },
                {
                    'name': 'Signage & Pricing',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Price tags are visible for all products',
                            'weight': 5,
                            'drivers': ['Missing price tags', 'Prices not updated', 'Wrong prices displayed']
                        },
                        {
                            'name': 'Promotional signage matches current offers',
                            'weight': 5,
                            'drivers': ['Expired promotion signs', 'No promotional signage', 'Incorrect pricing on signs']
                        },
                        {
                            'name': 'Signage is clean, undamaged, and professional',
                            'weight': 5,
                            'drivers': ['Torn/dirty signs', 'Faded printing', 'Handwritten corrections']
                        },
                    ]
                },
                {
                    'name': 'Seasonal Relevance',
                    'weight': 20,
                    'criteria': [
                        {
                            'name': 'Endcap products are seasonally appropriate',
                            'weight': 5,
                            'drivers': ['Off-season products displayed', 'Missed seasonal opportunity', 'Competing with adjacent seasonal displays']
                        },
                        {
                            'name': 'Cross-merchandising opportunities utilized',
                            'weight': 5,
                            'drivers': ['No complementary products', 'Missed cross-sell opportunity', 'No project-based bundling']
                        },
                    ]
                },
                {
                    'name': 'Cleanliness & Maintenance',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Display fixture is clean and in good condition',
                            'weight': 5,
                            'drivers': ['Dirty shelving', 'Damaged fixture', 'Rust/wear visible']
                        },
                        {
                            'name': 'Floor area around endcap is clean and clear',
                            'weight': 5,
                            'drivers': ['Debris on floor', 'Boxes blocking access', 'Spills not cleaned']
                        },
                        {
                            'name': 'No expired or damaged products on display',
                            'weight': 5,
                            'drivers': ['Expired products', 'Damaged packaging', 'Opened/used items']
                        },
                    ]
                },
            ]
        }
    },
    {
        'name': 'Seasonal Display Evaluation (Grills & Outdoor)',
        'description': 'Comprehensive evaluation of seasonal outdoor displays including grills, patio furniture, outdoor tools, and seasonal accessories. Ideal for spring/summer seasonal transitions.',
        'industry': 'hardware',
        'is_featured': True,
        'structure': {
            'sections': [
                {
                    'name': 'Grill Display Area',
                    'weight': 30,
                    'criteria': [
                        {
                            'name': 'Grills are properly assembled and positioned',
                            'weight': 5,
                            'drivers': ['Unassembled display models', 'Grills not spaced properly', 'Missing components on display models']
                        },
                        {
                            'name': 'Price and feature tags on every model',
                            'weight': 5,
                            'drivers': ['Missing price tags', 'No feature comparison cards', 'Outdated pricing']
                        },
                        {
                            'name': 'Grill accessories merchandised nearby',
                            'weight': 5,
                            'drivers': ['Accessories not near grills', 'No cross-sell displays', 'Out of stock accessories']
                        },
                        {
                            'name': 'Area is clean and inviting',
                            'weight': 5,
                            'drivers': ['Dirty grill area', 'Debris around displays', 'Unboxed packaging left out']
                        },
                    ]
                },
                {
                    'name': 'Outdoor Living & Patio',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Patio/outdoor furniture properly displayed',
                            'weight': 5,
                            'drivers': ['Furniture not assembled', 'Missing cushions/covers', 'Damaged display items']
                        },
                        {
                            'name': 'Outdoor decor and lighting shown effectively',
                            'weight': 5,
                            'drivers': ['Lights not working', 'Decor items disorganized', 'Missing display batteries']
                        },
                        {
                            'name': 'Seasonal plants and garden items visible',
                            'weight': 5,
                            'drivers': ['Dead/wilting display plants', 'Empty plant racks', 'No watering schedule visible']
                        },
                    ]
                },
                {
                    'name': 'Stihl / Outdoor Power Equipment',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Stihl display is properly maintained and organized',
                            'weight': 5,
                            'drivers': ['Dusty equipment', 'Products not in designated spots', 'Missing product cards']
                        },
                        {
                            'name': 'All featured models are on display',
                            'weight': 5,
                            'drivers': ['Empty display hooks', 'Featured model not available', 'Display model needs replacement']
                        },
                        {
                            'name': 'Safety and usage information available',
                            'weight': 5,
                            'drivers': ['Missing safety placards', 'No product brochures', 'Outdated literature']
                        },
                        {
                            'name': 'Pricing and comparison information visible',
                            'weight': 5,
                            'drivers': ['No pricing visible', 'Missing comparison charts', 'Outdated promotional material']
                        },
                    ]
                },
                {
                    'name': 'Seasonal Transition & Signage',
                    'weight': 20,
                    'criteria': [
                        {
                            'name': 'Seasonal banners and signage current',
                            'weight': 5,
                            'drivers': ['Last season signs still up', 'No seasonal banners', 'Damaged signage']
                        },
                        {
                            'name': 'Promotional pricing clearly displayed',
                            'weight': 5,
                            'drivers': ['Missing sale prices', 'Conflicting price signs', 'Expired promotions displayed']
                        },
                    ]
                },
            ]
        }
    },
    {
        'name': 'Paint Department Evaluation',
        'description': 'Evaluate the paint department including color displays, mixing station, supply organization, and customer experience. Covers Benjamin Moore, Clark+Kensington, and paint supplies.',
        'industry': 'hardware',
        'is_featured': True,
        'structure': {
            'sections': [
                {
                    'name': 'Color Display & Samples',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Color chip displays are fully stocked and organized',
                            'weight': 5,
                            'drivers': ['Empty color chip slots', 'Chips in wrong location', 'Outdated color collections']
                        },
                        {
                            'name': 'Paint brand displays are current (Benjamin Moore, Clark+Kensington)',
                            'weight': 5,
                            'drivers': ['Outdated brand displays', 'Missing brand sections', 'Damaged display racks']
                        },
                        {
                            'name': 'Sample cans/pints available and organized',
                            'weight': 5,
                            'drivers': ['No samples available', 'Samples disorganized', 'Sample inventory low']
                        },
                        {
                            'name': 'Color matching technology accessible and working',
                            'weight': 5,
                            'drivers': ['Equipment not working', 'Not accessible to customers', 'Needs calibration']
                        },
                    ]
                },
                {
                    'name': 'Mixing Station',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Paint mixing area is clean and organized',
                            'weight': 5,
                            'drivers': ['Spilled paint on counter', 'Cluttered work area', 'Equipment needs cleaning']
                        },
                        {
                            'name': 'Mixing equipment is in working order',
                            'weight': 5,
                            'drivers': ['Shaker broken', 'Tinting machine error', 'Calibration needed']
                        },
                        {
                            'name': 'Base paints are adequately stocked',
                            'weight': 5,
                            'drivers': ['Low base stock', 'Missing gallon sizes', 'Missing quart sizes']
                        },
                    ]
                },
                {
                    'name': 'Paint Supplies & Accessories',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Brushes, rollers, and trays well organized',
                            'weight': 5,
                            'drivers': ['Disorganized display', 'Missing popular sizes', 'Products in wrong location']
                        },
                        {
                            'name': 'Tape, drop cloths, and prep supplies stocked',
                            'weight': 5,
                            'drivers': ['Out of stock items', 'Messy display', 'No price tags']
                        },
                        {
                            'name': 'Primer and specialty products available',
                            'weight': 5,
                            'drivers': ['Missing primer options', 'No stain products', 'Specialty items not displayed']
                        },
                    ]
                },
                {
                    'name': 'Customer Experience',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Department is easy to navigate with clear aisle markers',
                            'weight': 5,
                            'drivers': ['No aisle signs', 'Confusing layout', 'Blocked aisles']
                        },
                        {
                            'name': 'Project inspiration/how-to materials available',
                            'weight': 5,
                            'drivers': ['No project guides', 'Outdated materials', 'Empty brochure rack']
                        },
                        {
                            'name': 'Staff knowledgeable and available in department',
                            'weight': 5,
                            'drivers': ['No staff in department', 'Staff unable to assist', 'Long wait times']
                        },
                    ]
                },
            ]
        }
    },
    {
        'name': 'Knife Display & Cutlery Evaluation',
        'description': 'Evaluate the knife and cutlery display area including product presentation, security, pricing, and brand-specific display compliance.',
        'industry': 'hardware',
        'is_featured': False,
        'structure': {
            'sections': [
                {
                    'name': 'Display Presentation',
                    'weight': 30,
                    'criteria': [
                        {
                            'name': 'Knife display case is clean and well-lit',
                            'weight': 5,
                            'drivers': ['Dirty display glass', 'Lights out/dim', 'Fingerprints on case']
                        },
                        {
                            'name': 'Products arranged by brand and type',
                            'weight': 5,
                            'drivers': ['Mixed brands in sections', 'No logical grouping', 'Missing category labels']
                        },
                        {
                            'name': 'All displayed items have price tags',
                            'weight': 5,
                            'drivers': ['Missing price tags', 'Incorrect prices', 'Tags hard to read']
                        },
                        {
                            'name': 'Feature/comparison cards visible',
                            'weight': 5,
                            'drivers': ['No feature information', 'Outdated product cards', 'Cards not visible']
                        },
                    ]
                },
                {
                    'name': 'Inventory & Stock',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'All display positions filled with product',
                            'weight': 5,
                            'drivers': ['Empty display hooks', 'Missing popular models', 'Placeholder items used']
                        },
                        {
                            'name': 'Popular brands adequately represented',
                            'weight': 5,
                            'drivers': ['Brand gaps', 'Insufficient variety', 'Only high-price items shown']
                        },
                        {
                            'name': 'Backup stock accessible for quick replenishment',
                            'weight': 5,
                            'drivers': ['No backup stock', 'Backup not organized', 'Reorder needed']
                        },
                    ]
                },
                {
                    'name': 'Security & Safety',
                    'weight': 25,
                    'criteria': [
                        {
                            'name': 'Display case lock functioning properly',
                            'weight': 5,
                            'drivers': ['Lock broken', 'Case left unlocked', 'Missing key']
                        },
                        {
                            'name': 'Security measures in place for high-value items',
                            'weight': 5,
                            'drivers': ['No security on expensive items', 'Security tags removed', 'Anti-theft devices not working']
                        },
                    ]
                },
                {
                    'name': 'Accessories & Cross-Selling',
                    'weight': 20,
                    'criteria': [
                        {
                            'name': 'Sharpening tools and maintenance products nearby',
                            'weight': 5,
                            'drivers': ['No sharpeners displayed', 'Maintenance items not near knives', 'Missing cutting boards']
                        },
                        {
                            'name': 'Gift sets and bundles featured',
                            'weight': 5,
                            'drivers': ['No gift set options', 'Sets not highlighted', 'Missing seasonal gift displays']
                        },
                    ]
                },
            ]
        }
    },
]

for tdata in templates_data:
    # Check if template already exists
    existing = IndustryTemplate.objects.filter(name=tdata['name']).first()
    if existing:
        print(f'  Already exists: {tdata["name"]}')
        continue

    IndustryTemplate.objects.create(
        name=tdata['name'],
        description=tdata['description'],
        industry=tdata['industry'],
        is_featured=tdata['is_featured'],
        structure=tdata['structure'],
    )
    print(f'  Created: {tdata["name"]}')

print('Done seeding templates.')
