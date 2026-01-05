# flooring.py - Ultimate Professional Floor Covering Calculator v3.2
# FULLY REFACTORED based on v3.0 specification.
# This version implements a three-stage processing pipeline, advanced seam preference logic,
# professional-grade output reporting, and waste/remnant analysis.
#
# MISSION: To function as an expert estimator, not a basic calculator.
# GUIDING PRINCIPLES:
# 1. Installer's Prime Directive: "Never Be Short."
# 2. The "Foggy Line" Principle: Illuminate the trade-off between Material Cost and Labor/Longevity.
# 3. The "No Magic Carpet" Rule: Respect physical reality and material constraints.
# 4. The Mandate to "Explain, Not Just State": Produce a thorough, trustworthy report.

import os
import json
import re
import math
import random
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# ============================= CONFIGURATION =============================
ACTION_NAME = "flooring"
ACTION_PRIORITY = 5.0
ACTION_VERSION = "3.2"
ACTION_DESCRIPTION = "Professional floor covering estimator with multiple seam layout strategies, waste analysis, expert reporting, and an upgraded library of retail humor."

# File paths for persistence
FLOORING_CONFIG_FILE = "flooring_config.json"
FLOORING_STATE_FILE = "flooring_state.json"
FLOORING_HISTORY_FILE = "flooring_history.json"

# ============================= STATE MANAGEMENT =============================
class FlooringState:
    """Manages all configuration and runtime state for the flooring addon."""
    
    def __init__(self):
        self.is_active = False
        self.config = self._get_default_config()
        self.runtime_state = self._get_default_state()
        self.calculation_history = []
        
    def _get_default_config(self) -> Dict[str, Any]:
        """Default configuration embodying professional standards."""
        return {
            "default_roll_width_ft": 12.0,
            "seam_allowance_inches": 3,
            "seam_preference": "optimized",  # 'optimized', 't-seam_saver', 'educational'
            "rounding_mode": "safe",  # 'safe' (rounds up), 'exact'
            "rounding_increment_ft": 0.5, # Rounds up to the nearest half-foot
            "input_mode": "raw_room", # 'raw_room', 'pre_cut' (user added allowance)
            "verbose_output": True,
            "last_saved": None
        }
    
    def _get_default_state(self) -> Dict[str, Any]:
        """Default runtime state."""
        return {
            "calculations_performed": 0,
            "total_linear_feet_calculated": 0.0,
            "last_calculation": None,
            "errors_caught": 0
        }
    
    def load_config(self):
        if os.path.exists(FLOORING_CONFIG_FILE):
            try:
                with open(FLOORING_CONFIG_FILE, 'r', encoding='utf-8') as f:
                    self.config.update(json.load(f))
            except Exception as e:
                print(f"[{ACTION_NAME.upper()}: Error loading config: {e}]")
    
    def save_config(self) -> bool:
        try:
            self.config["last_saved"] = datetime.now().isoformat()
            with open(FLOORING_CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2)
            return True
        except Exception as e:
            print(f"[{ACTION_NAME.upper()}: Error saving config: {e}]")
            return False

# Initialize state manager
state = FlooringState()

# ======================= STAGE 1: INPUT SANITIZATION ========================
def _parse_dimension_string(dim_str: str) -> Optional[float]:
    """Converts a variety of string inputs into a single internal unit: decimal feet."""
    dim_str = dim_str.strip().lower()
    
    # Handle fractions (e.g., "15 1/2", "15-1/2")
    match_frac = re.match(r'(\d+)\s*(?:-|and\s*)?\s*(\d+)\s*/\s*(\d+)', dim_str)
    if match_frac:
        feet = int(match_frac.group(1))
        num = int(match_frac.group(2))
        den = int(match_frac.group(3))
        return feet + (num / den)

    # Handle decimal feet (e.g., "15.5", "15.5ft")
    match_dec = re.search(r'(\d+\.?\d*)', dim_str)
    if not match_dec: return None
    val = float(match_dec.group(1))
    
    # Handle units
    if "inch" in dim_str or "'" not in dim_str and "ft" not in dim_str:
        return val / 12.0 # Assume inches if no unit is specified
    return val # Assume feet

def parse_input_to_measurements(args: str) -> Optional[Dict[str, float]]:
    """Takes full command args and returns sanitized length and width in feet."""
    # Find dimensions like 15x16, 15.5' x 140", etc.
    match = re.search(r'(.+?)\s*[xX]\s*(.+)', args)
    if not match: return None
    
    length_str = match.group(1)
    width_str = match.group(2)
    
    length_ft = _parse_dimension_string(length_str)
    width_ft = _parse_dimension_string(width_str)
    
    if length_ft is None or width_ft is None: return None
    return {"length": length_ft, "width": width_ft}

# ======================= STAGE 2: CORE CALCULATION ENGINE ========================
class CarpetCalculator:
    """The refactored expert calculation engine."""

    @staticmethod
    def _round_up_to_increment(value: float, increment: float) -> float:
        """Enforces the Installer's Prime Directive."""
        if increment <= 0: return value # Avoid division by zero
        return math.ceil(value / increment) * increment

    @staticmethod
    def calculate_carpet_needed(
        length: float, 
        width: float,
        roll_width: float = 12.0,
        pattern_repeat_ft: float = 0.0,
        seam_allowance_inches: int = 3,
        seam_preference: str = 'optimized',
        rounding_mode: str = 'safe',
        input_mode: str = 'raw_room',
        available_remnants: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Orchestrator for all carpet calculation logic."""

        # Add seam allowance if user provided raw room dimensions
        seam_allowance_ft = (seam_allowance_inches / 12.0)
        cut_length = length + seam_allowance_ft * 2 if input_mode == 'raw_room' else length
        cut_width = width + seam_allowance_ft * 2 if input_mode == 'raw_room' else width

        # For pattern match, adjust the length of each pull
        # NOTE: Placeholder logic. Full pattern matching is complex.
        if pattern_repeat_ft > 0:
            cut_length = math.ceil(cut_length / pattern_repeat_ft) * pattern_repeat_ft
        
        # Decide which layout strategies to compute
        calc_methods = {
            'optimized': CarpetCalculator._calculate_optimized_seam_layout,
            't-seam_saver': CarpetCalculator._calculate_t_seam_layout,
        }

        results = {}
        for pref, method in calc_methods.items():
            # Run calculation for both directions (L x W and W x L) to find the best orientation
            layout1 = method(cut_length, cut_width, roll_width, 'lengthwise', rounding_mode)
            layout2 = method(cut_width, cut_length, roll_width, 'widthwise', rounding_mode)
            results[pref] = layout1 if layout1['total_linear_feet'] <= layout2['total_linear_feet'] else layout2

        if seam_preference == 'educational':
            # In educational mode, return both calculations for comparison
            primary = results['t-seam_saver']
            secondary = results['optimized']
            if results['optimized']['total_linear_feet'] <= results['t-seam_saver']['total_linear_feet']:
                primary, secondary = secondary, primary
            
            primary['alternative_calculation'] = secondary
            final_result = primary
        else:
            final_result = results.get(seam_preference, results['optimized'])
            
        # Add common final details
        final_result.update({
            "room_length": length,
            "room_width": width,
            "cut_length": cut_length,
            "cut_width": cut_width,
            "seam_preference": seam_preference,
            "room_area_sqft": length * width
        })
        return final_result

    @staticmethod
    def _calculate_optimized_seam_layout(length: float, width: float, roll_width: float, direction: str, rounding_mode: str) -> Dict[str, Any]:
        """Calculates material for the standard single-seam method."""
        num_pulls = math.ceil(width / roll_width)
        pull_length = length
        
        # Round the final warehouse cut length
        rounded_pull_length = CarpetCalculator._round_up_to_increment(pull_length, state.config["rounding_increment_ft"]) if rounding_mode == 'safe' else pull_length

        total_lf = rounded_pull_length * num_pulls
        total_sqft = total_lf * roll_width
        
        return {
            "seam_type": "optimized",
            "direction": direction,
            "total_linear_feet": total_lf,
            "warehouse_pulls": [{"length": rounded_pull_length, "width": roll_width} for _ in range(num_pulls)],
            "room_cuts": [
                {"length": length, "width": roll_width}, # Main piece
                {"length": length, "width": width - roll_width} # Fill piece
            ],
            "total_sqft_ordered": total_sqft,
            "num_seams": num_pulls - 1,
            "rounding_applied": pull_length != rounded_pull_length
        }
    
    @staticmethod
    def _calculate_t_seam_layout(length: float, width: float, roll_width: float, direction: str, rounding_mode: str) -> Dict[str, Any]:
        """Calculates material for the T-seam method to minimize linear footage."""
        main_pull_length = length
        fill_width_needed = width - roll_width
        if fill_width_needed <= 0: # Room isn't wide enough for a T-seam
             return CarpetCalculator._calculate_optimized_seam_layout(length, width, roll_width, direction, rounding_mode)

        # How many strips can we rip from the roll width?
        strips_from_roll = math.floor(roll_width / fill_width_needed)
        if strips_from_roll == 0: # Strips needed are wider than the roll itself, impossible
            return CarpetCalculator._calculate_optimized_seam_layout(length, width, roll_width, direction, rounding_mode)
        
        # How many small pieces do we need to make the fill? (Assume one T-seam for now)
        num_pieces_for_fill_length = 2
        small_piece_length = length / num_pieces_for_fill_length

        # Calculate the length of the warehouse pull for the fill
        fill_pull_length = math.ceil(num_pieces_for_fill_length / strips_from_roll) * small_piece_length
        
        # Apply the Prime Directive
        rounded_main_pull_length = CarpetCalculator._round_up_to_increment(main_pull_length, state.config["rounding_increment_ft"]) if rounding_mode == 'safe' else main_pull_length
        rounded_fill_pull_length = CarpetCalculator._round_up_to_increment(fill_pull_length, state.config["rounding_increment_ft"]) if rounding_mode == 'safe' else fill_pull_length
        
        total_lf = rounded_main_pull_length + rounded_fill_pull_length
        total_sqft = total_lf * roll_width

        return {
            "seam_type": "t-seam_saver",
            "direction": direction,
            "total_linear_feet": total_lf,
            "warehouse_pulls": [
                {"length": rounded_main_pull_length, "width": roll_width},
                {"length": rounded_fill_pull_length, "width": roll_width}
            ],
            "room_cuts": [
                {"length": length, "width": roll_width}, # Main piece
                {"length": small_piece_length, "width": fill_width_needed}, # Fill A
                {"length": small_piece_length, "width": fill_width_needed}, # Fill B
            ],
            "fill_details": { "strips_from_roll": strips_from_roll },
            "total_sqft_ordered": total_sqft,
            "num_seams": 2, # One main seam and one cross-seam
            "rounding_applied": (fill_pull_length != rounded_fill_pull_length) or (main_pull_length != rounded_main_pull_length)
        }


# ============================= LIFECYCLE AND I/O =============================
async def start_action(system_functions=None):
    if state.is_active: return
    state.is_active = True
    state.load_config()
    print(f"[{ACTION_NAME.upper()} v{ACTION_VERSION} STARTED]")

async def stop_action(system_functions=None):
    if not state.is_active: return
    state.is_active = False
    state.save_config()
    print(f"[{ACTION_NAME.upper()} STOPPED]")

async def process_input(user_input: str, system_functions=None, is_system_command: bool = False):
    if not state.is_active: return user_input
    if not user_input.lower().startswith("flooring"): return user_input
    
    parts = user_input.strip().lower().split(maxsplit=2)
    command = parts[1] if len(parts) > 1 else "help"
    args = user_input.split(maxsplit=2)[-1] if len(parts) > 2 else ""

    if command == "calculate":
        measurements = parse_input_to_measurements(args)
        if not measurements:
            return "[FLOORING: Invalid dimension format. Use format like '15.5ft x 140 inches']"
        
        calculation = CarpetCalculator.calculate_carpet_needed(
            length=measurements['length'],
            width=measurements['width'],
            roll_width=state.config['default_roll_width_ft'],
            seam_allowance_inches=state.config['seam_allowance_inches'],
            seam_preference=state.config['seam_preference'],
            rounding_mode=state.config['rounding_mode'],
            input_mode=state.config['input_mode']
        )
        return _format_detailed_result(calculation) # STAGE 3
        
    elif command == "set":
        key, val = (args.split(maxsplit=1) + [None])[:2]
        if key in state.config:
            # Type casting for safety
            if isinstance(state.config[key], (int, float)):
                try: state.config[key] = type(state.config[key])(val)
                except (ValueError, TypeError): return f"Invalid value for {key}."
            else:
                state.config[key] = val
            state.save_config()
            return f"[{ACTION_NAME.upper()}: Set {key} to {state.config[key]}]"
        return f"[{ACTION_NAME.upper()}: Unknown config key '{key}']"

    elif command == "status":
        return "\n".join([f"[{ACTION_NAME.upper()} STATUS REPORT]",
                          f"Version: {ACTION_VERSION}",
                          f"Seam Preference: {state.config['seam_preference']}",
                          f"Rounding Mode: {state.config['rounding_mode']} (to nearest {state.config['rounding_increment_ft']} ft)"])

    else: # Help command
        return f"""[{ACTION_NAME.upper()} HELP - v{ACTION_VERSION}]
  flooring help                      - Show this help
  flooring status                    - Show current config
  flooring calculate <L>x<W>         - Calculate carpet needed. Accepts units like ft, ', inch, ".
  flooring set <key> <value>         - Set config. Keys: seam_preference, rounding_mode, etc."""

async def process_output(ai_response: str, system_functions=None):
    return ai_response # No output processing needed.

# ===================== STAGE 3: OUTPUT FORMATTING & MOUTHPIECE ======================
def _generate_ascii_cut_map(calc: Dict[str, Any]) -> str:
    """Generates the VISUAL CUT MAP portion of the report."""
    pulls = calc.get('warehouse_pulls', [])
    cuts = calc.get('room_cuts', [])
    output = ["VISUAL CUT MAP (Pulls from Warehouse):"]

    if calc['seam_type'] == 't-seam_saver':
        main_pull, fill_pull = pulls[0], pulls[1]
        main_cut, fill_cut_a, fill_cut_b = cuts[0], cuts[1], cuts[2]

        remnant_width = main_pull['width'] - fill_cut_a['width'] * calc['fill_details']['strips_from_roll']
        
        # Diagram construction
        map_lines = [
            f"Pull #1 ({main_pull['width']:.1f}' x {main_pull['length']:.2f}'):".ljust(37) + f"Pull #2 ({fill_pull['width']:.1f}' x {fill_pull['length']:.2f}'):",
            f"+{'-'*34}+" + " " * 3 + f"+{'-'*28}+",
            f"|{'Main Room Piece'.center(34)}|" + " " * 3 + f"|{'Room Cut A'.center(28)}|",
            f"|{f'({main_cut["width"]:.1f}\' x {main_cut["length"]:.2f}\')'.center(34)}|" + " " * 3 + f"|{f'({fill_cut_a["width"]:.1f}\' x {fill_cut_a["length"]:.2f}\')'.center(28)}|",
            f"|{''.center(34)}|" + " " * 3 + f"+{'-'*28}+",
            f"|{''.center(34)}|" + " " * 3 + f"|{'Room Cut B'.center(28)}|",
            f"+{'-'*34}+" + " " * 3 + f"|{f'({fill_cut_b["width"]:.1f}\' x {fill_cut_b["length"]:.2f}\')'.center(28)}|",
            f"(No significant remnant)".ljust(37) + f"+{'-'*28}+",
            "".ljust(40) + f"|{'**USEFUL REMNANT**'.center(28)}|",
            "".ljust(40) + f"|{f'({remnant_width:.1f}\' x {fill_pull["length"]:.2f}\')'.center(28)}|",
            "".ljust(40) + f"+{'-'*28}+"
        ]
        output.extend(map_lines)
    else: # Optimized layout
        # This part is simplified as it's a more direct cut
        output.append("Visual map for OPTIMIZED is straightforward: fill piece is cut from the second pull.")

    return "\n".join(output)


def _format_detailed_result(calc: Dict[str, Any]) -> str:
    """The master function for generating the new, thorough report format."""
    total_ordered_sqft = calc.get('total_sqft_ordered', 0)
    room_sqft = calc.get('room_area_sqft', 0)
    waste_sqft = max(0, total_ordered_sqft - room_sqft)
    waste_percent = (waste_sqft / total_ordered_sqft * 100) if total_ordered_sqft > 0 else 0

    # Build the report sections
    header = [
        f"[{ACTION_NAME.upper()}: CARPET CALCULATION RESULTS v{ACTION_VERSION}]",
        "=" * 60,
        f"Room: {calc['room_length']:.1f}' x {calc['room_width']:.1f}' ({room_sqft:.1f} sq ft)",
        f"Layout Preference: {calc['seam_type'].upper().replace('_', '-')}"
    ]

    warehouse_order = ["\n**WAREHOUSE ORDER (Carpet Cut List):**"]
    for i, pull in enumerate(calc.get('warehouse_pulls', [])):
        desc = f"For {'main run' if i == 0 else 'fill piece'}"
        warehouse_order.append(f"- Pull #{i+1}: {pull['width']:.1f}' x {pull['length']:.2f}' ({desc})")
    warehouse_order.append(f"- **TOTAL ORDER: {calc['total_linear_feet']:.2f} LINEAR FEET of {state.config['default_roll_width_ft']}' carpet**")
    
    installer_cuts = ["\n**INSTALLER ON-SITE CUTS (Room Cuts):**"]
    if calc['seam_type'] == 't-seam_saver':
        main_cut, fill_a, fill_b = calc['room_cuts']
        installer_cuts.append(f"- Main piece: One {main_cut['width']:.1f}' x {main_cut['length']:.2f}' piece.")
        installer_cuts.append(f"- Fill pieces: From the second pull, two {fill_a['width']:.1f}' x {fill_a['length']:.2f}' strips will be cut and seamed end-to-end.")
    else:
         main_cut, fill_cut = calc['room_cuts']
         installer_cuts.append(f"- Main piece: One {main_cut['width']:.1f}' x {main_cut['length']:.2f}' piece.")
         installer_cuts.append(f"- Fill piece: A {fill_cut['width']:.1f}' wide strip will be cut from the second pull.")

    waste_analysis = [
        "\n" + "---[ WASTE & REMNANT ANALYSIS ]".ljust(60, '-'),
        "\n" + _generate_ascii_cut_map(calc) if calc['seam_type'] == 't-seam_saver' else "",
        f"\nWASTE BREAKDOWN (Total: {waste_sqft:.1f} sq ft | {waste_percent:.1f}%):"
    ]
    # Add descriptive waste reason
    allowance_ft = state.config['seam_allowance_inches'] / 12.0
    trim_waste_approx = (calc['cut_length'] + calc['cut_width']) * 2 * allowance_ft
    if calc['seam_type'] == 't-seam_saver':
         width_waste = (calc['warehouse_pulls'][1]['width'] - calc['room_cuts'][1]['width'] * calc['fill_details']['strips_from_roll']) * calc['warehouse_pulls'][1]['length']
         waste_analysis.append(f"  - Width Cut Waste: ~{width_waste:.1f} sq ft. Material left after ripping fill strips from the pull. Most of this forms the useful remnant.")
         waste_analysis.append(f"  - Trim/Seam Waste: ~{trim_waste_approx:.1f} sq ft. Minor loss from the {state.config['seam_allowance_inches']}\" trimming allowance.")
    else:
        waste_analysis.append("  - Waste is primarily from cutting the fill piece and trim allowance.")

    waste_analysis.append("\nREMNANT ASSESSMENT:")
    if calc['seam_type'] == 't-seam_saver':
         remnant_width = calc['warehouse_pulls'][1]['width'] - calc['room_cuts'][1]['width'] * calc['fill_details']['strips_from_roll']
         remnant_length = calc['warehouse_pulls'][1]['length']
         waste_analysis.append(f"- [USEFUL]: ONE piece, approx. {remnant_width:.1f}' x {remnant_length:.2f}', ideal for a closet or patch.")
    else:
        waste_analysis.append("- [MINIMAL]: Remnants from this layout are typically long, narrow strips with limited use.")
    
    pro_notes = [
        "\n" + "-"*60,
        "PRO NOTES:"
    ]
    if 'alternative_calculation' in calc:
        savings = abs(calc['total_linear_feet'] - calc['alternative_calculation']['total_linear_feet'])
        pro_notes.append(f"- The {calc['seam_type'].upper().replace('_', '-')} layout saves {savings:.2f} linear feet compared to the {calc['alternative_calculation']['seam_type'].upper().replace('_','-')} method.")

    if calc.get('rounding_applied', False):
        pro_notes.append(f"- Calculated length requirements were rounded up to the nearest {state.config['rounding_increment_ft']} ft to ensure sufficient material.")

    # --- START OF MENARDS FUN FACT ADDITION (v2) ---
    department_name_options = ['Electrical', 'Plumbing', 'Millwork', 'Building Materials', 'Paint', 'Hardware', 'Garden Center']
    num_carry_outs = max(1, int(room_sqft / 12)) 
    cuts_per_hour = random.randint(2, 5)

    fun_fact_templates = [
        "Approximately {num_carry_outs} customer carry-out carts could fit in this room.",
        "This room is roughly half the size of the {department_name} department.",
        "A new Floorcoverings team member is expected to perform {cuts_per_hour} cuts of this complexity per hour.",
        "The General Manager is probably wondering if you're 'gonna get on top of it' or not.",
        "While you were calculating this, someone up front needed help identifying a 12-cent tile.",
        "PRO-TIP: Double-check this roll for forklift holes. You know how Receiving gets.",
        "Remember to roll this nap-in, not like that new manager who rolled an entire house job backwards.",
        "Before you start, make sure this roll wasn't mislabeled by the DC and sent to the wrong store.",
        "Factor in an extra 15 minutes for the customer who needs their blinds cut while you're at the cutter.",
        "The time it took you to do this math is precisely how long the customer has been waiting at the desk.",
        "This much carpet weighs more than a pallet of concrete bags from Building Materials.",
        "Hope you got a measure for this job! Otherwise, you'll be cutting it twice.",
        "While you were calculating this, a customer unrolled an entire remnant in the main aisle.",
        "Don't forget to sweep up the mountain of carpet fibers. Our store's cleaning budget thanks you.",
        "This roll has been sitting here so long, it's started to develop its own personality.",
        "Warning: The plastic wrap on this roll will disintegrate into a thousand pieces the moment you touch it.",
        "Somewhere, a lumber associate just dropped an entire bunk of plywood. We all heard it.",
        "The customer for this cut will be back in 10 minutes to say they measured wrong. It's a guarantee.",
        "Your InFocus captain wants to remind you to bend at the knees and use a safety knife.",
        "Get ready for the inevitable question: 'So, you guys install this for free, right?'",
        "The length of this cut is roughly the distance from here to the only working restroom in the store.",
        "This particular carpet is known for dulling blades faster than a manager can say 'huddle up.'",
        "A Hardware associate is about to page 'flooring associate to the carpet machine,' even though you're standing here.",
        "Corporate would like to remind you that you should have also sold padding, installation, and a credit card.",
        "The square footage of this room is equal to the number of abandoned carts in the parking lot on a Saturday.",
        "This room is large enough to hold all the ZMA'd special orders from the Millworks department.",
        "Is the customer for this the same one who tried to pay for a pallet of tile with a personal check?",
        "Remember that time we found a mummified mouse inside a roll? Check this one.",
        "This cut generates enough static electricity to power the display TVs for 3.7 seconds.",
        "Be prepared for the customer to ask for a discount on the remnant piece they're not even buying.",
        "This much carpet could absorb the entire gallon of 'oops paint' that just spilled in Aisle 9.",
        "Your Department Supervisor is watching from a distance, pretending they know how to operate this machine.",
        "Fun Fact: This remnant has been here longer than the last three store managers.",
        "The customer is currently at the Service Desk complaining that their cut isn't ready yet.",
        "The calculation for this cut is more complex than the new scheduling system that gave you a 4-hour shift.",
        "A 'Go-Getter' award nomination is surely in your future for this masterful cut.",
        "PRO-TIP: The customer's '12 feet' is almost always '12 feet and a few inches.' Give 'em extra.",
        "You could line the entire path of a Black Friday queue with this much carpet.",
        "The General Manager just paged 'Code 50' to the front end. It's for cake. You're missing it.",
        "Careful, this pattern has a match. You don't want a repeat of the 'incident'.",
        "The customer needs this for their 'art project.' Be prepared for it to be an unusual shape.",
        "This roll has been on the top rack for so long it may now be classified as a fossil.",
        "The sound of this cutter is a homing beacon for customers with 'just a quick question'.",
        "You've now spent more time on this than the average lifespan of a seasonal garden associate.",
        "Quick, look busy! An Assistant Manager is approaching with a clipboard.",
        "A plumbing associate just asked if we sell 'those things for under the toilet.' They mean a wax ring. Again.",
        "Make sure to add the 'fudge factor.' You know they can't measure.",
        "This cut is for a rental property, which means they want the cheapest pad you have in stock.",
        "Fact: The odds of the customer having their order number ready are less than 10%.",
        "The customer would like to fit this 12-foot wide roll into their 4-door sedan. Good luck with that.",
        "Your lunch break officially started 20 minutes ago. Enjoy!",
        "This is the third carpet cut of the hour. Your 'Success Sharing' check will be $14.50.",
        "Congratulations! You are now 80% carpet fiber by volume.",
        "A part-timer in Millworks just sold the wrong-sized door. Again. You'll hear the customer's rage shortly.",
        "The static shock you'll get from this is the most energy you'll feel all day.",
        "Be ready for the customer to bring back their scrap piece tomorrow and ask for a refund on it.",
        "The customer wants to know if this carpet is 'pet proof.' You know it's not. They will buy it anyway.",
        "Remember to smile; you're on 14 different security cameras from 3 different angles.",
        "PRO-TIP: The 'good' measuring tape is hidden in the back cabinet. This one is off by a 1/4 inch.",
        "This particular pattern is so old it's officially considered 'retro-chic' now.",
        "An 'Associate of the Month' parking spot is not in your future, but carpal tunnel might be.",
        "A MET team member just moved the bay locator sign for this carpet to Aisle 42. No one knows why.",
        "The beeping you hear is a Ballymore lift that's been begging for a charge since your shift started.",
        "Someone just requested forklift assistance for a single box of tile.",
        "Is this the roll that's famously difficult to cut straight? Yes. Yes it is.",
        "Hope you wore your back brace today. Corporate 'cares' about your safety.",
        "The dust from this roll contains allergens from the Mesozoic Era.",
        "The customer would like this 'rolled on a tube,' but all the cardboard tubes were thrown in the baler yesterday.",
        "Somewhere, a cart attendant is battling a hydra of 15 shopping carts nested together in a single corral.",
        "The 'New Lower Price' sign for this roll fell down three weeks ago. No one has noticed.",
        "This remnant's length is precisely equal to that of a manager's 'motivational' morning speech.",
        "This calculation is an excellent use of that college degree.",
        "The store's closing announcement is about to play for the first of six times.",
        "Get ready for the customer to tell you about the YouTube video they watched, making them an expert.",
        "That smell is the new shipment of mulch in the Garden Center. It's everywhere now.",
        "This is a great time to check when your next performance review is scheduled. Or if it ever was.",
        "The reward for finishing this complex cut is another, more complicated cut waiting for you.",
        "The customer just realized they forgot to buy the matching pad. They'll be back in an hour.",
        "This roll has been in more inventory counts than you have."
    ]

    selected_template = random.choice(fun_fact_templates)
    formatted_fact = selected_template.format(
        num_carry_outs=num_carry_outs,
        department_name=random.choice(department_name_options),
        cuts_per_hour=cuts_per_hour
    )
    pro_notes.append(f"- [Menards Fun Fact]: {formatted_fact}")
    # --- END OF MENARDS FUN FACT ADDITION ---

    pro_notes.append("=" * 60)

    # Combine all parts
    full_report = "\n".join(header + warehouse_order + installer_cuts + waste_analysis + pro_notes)
    
    # If educational, append the alternative calculation
    if 'alternative_calculation' in calc:
        alt_calc = calc['alternative_calculation']
        alt_report_header = [f"\n---[ ALTERNATIVE: '{alt_calc['seam_type'].upper().replace('_','-')}' LAYOUT ]---"]
        alt_warehouse = ["\n**WAREHOUSE ORDER:**"]
        for pull in alt_calc['warehouse_pulls']: alt_warehouse.append(f"- {pull['width']:.1f}' x {pull['length']:.2f}'")
        alt_warehouse.append(f"- **TOTAL ORDER: {alt_calc['total_linear_feet']:.2f} LINEAR FEET**")
        full_report += "\n".join(alt_report_header + alt_warehouse)

    return full_report