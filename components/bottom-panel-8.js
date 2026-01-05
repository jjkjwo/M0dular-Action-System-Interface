/**
 * ==============================================================================================
 * Bottom Panel 8 - Enhanced Silent-Structure Translator (v4.3.1 - Fixed Initialization)
 * ==============================================================================================
 *
 * This file provides an enhanced UI for translating between "Silent-Structure" (SS) patterns
 * and natural language (NL), with interactive visual elements, suggestions, and easier access
 * to SS patterns without requiring deep knowledge of the language.
 *
 * FIX: Added missing prepareSortedKeys method and fixed binding issues in event listeners
 * to properly initialize the component and prevent errors when opening the panel.
 *
 * @version 4.3.1 - Fixed initialization and event binding issues.
 */

(function() {
    // Component definition
    const component = {
        id: 'bottom-panel-8',

        // DOM references
        dom: {
            content: null,
            inputArea: null,
            outputArea: null,
            directionToggle: null,
            directionLabelSpan: null,
            translateButton: null,
            inputLabel: null,
            outputLabel: null,
            visualBuilder: null,
            commonPatterns: null, // Stores references for the Patterns tab
            suggestionArea: null,
            symbolPalette: null,
            suggestionsContainer: null, // Added to cache
            helpDialog: null, // Added to cache
            helpOverlay: null // Added to cache
        },

        // Component state
        state: {
            translateSS_to_NL: true, // Default direction is SS -> NL.
            recentSuggestions: [],   // Store recent suggestions for quick access
            currentSymbolCategory: 'core', // Active symbol category
            savedPatterns: [],       // User's saved patterns
            undoStack: [],           // For undo functionality
            redoStack: [],           // For redo functionality
            currentHover: null,      // Current hovered element
            symbolCategories: [
                { id: 'core', name: 'Core Symbols', icon: '🔍' },
                { id: 'flow', name: 'Flow & Relations', icon: '⇒' },
                { id: 'structure', name: 'Structures', icon: '< >' },
                { id: 'states', name: 'States & Tags', icon: '📝' },
                { id: 'logic', name: 'Logic & Control', icon: '🔄' }
            ],

            // --- Co-Evolved Silent-Structure Lexicon (Grammar Definition) ---
            lexicon: {
                // 1. Core Symbols: The minimalist, atomic building blocks of SS patterns.
                coreSymbols: {
                    // Participant & Container Symbols
                    '[]': 'User State/Container (Represents the User\'s domain, state, or input/output container)',
                    '{}': 'AI State/Container (Represents the AI\'s domain, state, structure output, or query container)',
                    '<>': 'Conceptual Frame / Scoped Unit (Groups concepts, patterns, rules, or process blocks semantically)', // Main structural bracket
                    '()': 'Grouping / Sub-context (Used for explicit grouping within conditions or for option containers in choices)',
                    // Basic Pattern Constituent Symbols (used in repeating patterns)
                    '.': 'Minimal Unit / Low Intensity Point / Processing Marker (Used in dot patterns)',
                    '-': 'Break / Simple Separator Marker (Used in dash patterns)',
                    '_': 'Placeholder / Extended Break Marker (Used in underscore patterns)',
                    '*': 'Confirmation / Agreement Marker (Can form repeating patterns)',
                    '!': 'Emphasis / Alert Marker (Can form repeating patterns, often with `!!!`)',
                    '$': 'Evaluation / Value Indicator (Can form repeating patterns `$$?` `[$?]`)',
                    '#': 'Comment / Annotation Marker / Obfuscation Component (Contextual - can start comments or be part of noise)', // Can form repeating patterns
                    '|': 'Alternation / Choice Link / Separator (Used within `()` choices, or forms `||` patterns)', // Can form repeating patterns (pipes)
                    '‖': 'Obfuscation Marker (Double Pipe Variant)', // Co-evolved as alternative obfuscation
                    // Flow, Relation, Operator Symbols
                    '⇒': 'Primary Directional Flow / Leads To / Processes To (Core Sequential/Causal Link)', // Core flow link
                    '≺≻': 'Primary Mutual Interaction / Exchange (Bidirectional Relational Link)', // Core relation link
                    '∥': 'Parallel Flow Link (Represents concurrency or options)', // Core flow link
                    '~': 'Internal Modifier / Association Link (Links detail to item/state, e.g., Item ~ {Details})', // Modifier link
                    '@': 'Item Location Relation (Links an item to its location/status context, e.g., Item @ Location)', // Relational symbol
                    '=': 'Assignment Operator (Sets state value in MutateState) / Comparison Operator (Equals)', // Operator/Symbol
                    '>': 'Comparison Operator (Greater Than)', // Operator
                    '<': 'Comparison Operator (Less Than)', // Operator
                    '>=': 'Comparison Operator (Greater Than or Equal To)', // Operator
                    '<=': 'Comparison Operator (Less Than Or Equal To)', // Operator
                    '&': 'Logical Operator (AND - Symbol)', // Boolean Logic Operator
                    '|': 'Logical Operator (OR - Symbol)', // Boolean Logic Operator (Avoid confusion with ||/‖)
                    '¬': 'Logical Operator (NOT - Symbol)', // Boolean Logic Operator

                    // Specific Conceptual Space Symbols (Co-evolved)
                    '📝': 'Conceptual Space: Scratchpad / Work-in-Progress Area',
                    '📦': 'Conceptual Space: Archive / Storage Area',
                    '🖥️': 'Conceptual Space: Presentation / Output Area',
                    '🗑️': 'Conceptual Space: Discard / Rejection Area',

                    // Specific Routine Stage Symbols (Co-evolved Example Scenario)
                    '⏰': 'Conceptual Stage/State: Routine Wake Time / Clock', // Re-used symbol
                    '⚒️': 'Conceptual Stage/State: Routine Work / Effort', // Re-used symbol
                    '💤': 'Conceptual Stage/State: Routine Rest / Sleep', // Re-used symbol
                    '🎮': 'Conceptual Stage/State: Routine Play / Leisure', // Re-used symbol

                    // Specific Scenario State/Outcome Symbols (Co-evolved Secure Data Processing & Logic Sims)
                    '🔐': 'Item State: Encryption Status / Locked Securely', // Secure Data Processing
                    '🔑': 'Item State: Authentication Status / Valid Key (Can represent status like TRUE)', // Secure Data Processing / Logic Sims
                    '📜': 'Item State: Compliance Status / Compliant Document', // Secure Data Processing
                    '🔒': 'Item State: Locked / Restricted Access (Generic Locked State)', // Logic Sims Example
                    '🧾': 'Item State: Receipt / Record / Processed Document (Generic Document State)', // Logic Sims Example
                    '📌': 'Item State: Pinned / Important Marker / Highlighted Item', // Logic Sims Example
                    '📎': 'Item State: Attached / Linked / Included Component', // Logic Sims Example
                    '🛑': 'Item State: Stop Signal / Blocked / Halted', // Logic Sims Example
                    '🌍': 'Item State: Global Context / External Environment', // Logic Sims Example
                    '📤': 'Conceptual Outcome: Data Sent Out / Egress (Alternative Success Path Label)', // Logic Sims Example
                    '✅': 'Conceptual Outcome/Result: Success Path / True Logical Result', // Logic Sims & Workflow End State
                    '❌': 'Conceptual Outcome/Result: Failure Path / False Logical Result', // Logic Sims & Workflow End State

                     // Specific State Value Types (Co-evolved for specific scenarios)
                    '📉': 'Loop Exit Reason/Outcome: Cooling Complete / Temp Condition Met Successfully', // Cooling System
                    '⁉️': 'Loop Exit Reason/Outcome: Multi-condition Exit / Unexpected Loop State', // Cooling System & Data Proc. (Catch-all Reason)
                    '❗': 'Item State: High Sensitivity / Urgent / Requires Alert (Used as a symbol *and* value/reason label)', // Re-used symbol as value/reason
                     '🔒,': 'Item State List Separator (Special composite - should be lower in priority than actual states)', // Workaround for `{State1, State2}` parsing if , is needed

                    // Boolean Literal Values (Often used with State = )
                    'TRUE': 'Boolean Value: Logical True',
                    'FALSE': 'Boolean Value: Logical False',
                },

                // 2. Structural Elements - Keyword-based patterns or bracket usages that define larger structural roles.
                 structuralElements: {
                     // These keys are fragments used to identify structure, full validation relies on how they're used in context
                     'IF{': 'Conditional Gate (Starts a logic check block `{}` for branching)',
                     'THEN⇒': 'Conditional Gate Path: True Outcome (Follows IF{} check)', // Part of Decision Gate Syntax
                     'ELSE⇒': 'Conditional Gate Path: False Outcome (Follows IF{} check)', // Part of Decision Gate Syntax
                     'ELSE IF{': 'Conditional Gate Path: Alternative Check (Chains multiple checks)', // Part of nested IF/ELSE IF logic
                     'LOOP UNTIL': 'Loop Structure (Starts a repeating block `[LOOP UNTIL Condition] : {...}`)', // Part of Loop Syntax
                     'ON_EXIT:': 'Loop Exit Handler (Starts a block `{}` executed upon loop termination `⇒ ON_EXIT: {...}`)', // Part of Loop Syntax
                     'MutateState :': 'State Mutation Operation (Inside `{}` block to change item state `MutateState : State = Value`)', // Part of Mutation Syntax
                     'Description =': 'Definition Meta-Tag (Describes purpose/role of element/pattern)', // Part of Meta-Language Definitions
                     'PatternStructure =': 'Definition Meta-Tag (Documents the syntax pattern of an element/structure)', // Part of Meta-Language Definitions
                     'Rule =': 'Definition Meta-Tag (Documents a grammar rule associated with an element/structure)', // Part of Meta-Language Definitions
                     'Context =': 'Definition Meta-Tag (Documents where an element/rule applies)', // Part of Meta-Language Definitions
                     'Relationship =': 'Definition Meta-Tag (Documents how elements relate conceptually)', // Part of Meta-Language Definitions
                     'Interpretation =': 'Definition Meta-Tag (Documents behavior/meaning in context, e.g., Nested IF boolean)', // Part of Meta-Language Definitions
                     'Impact =': 'Definition Meta-Tag (Documents consequence of a rule/element)', // Part of Meta-Language Definitions
                     'LogicPriorityOrder =': 'Definition Meta-Tag (Documents precedence rules visually)', // Part of Meta-Language Definitions
                     'OutcomeLogic =': 'Definition Meta-Tag (Documents logic for determining outcomes/reasons)', // Part of Meta-Language Definitions
                     '<<': 'Start Nested Conceptual Frame ( `< < ... > >` )', // For parsing nested <>
                     '>>': 'End Nested Conceptual Frame', // For parsing nested <>
                 },

                // 3. Repeating Patterns - Visual sequences identifiable by character repetition.
                 repeatingPatterns: {
                     dots: (len) => `Pattern: Dots (${len}x, Intensity/Processing)`,
                     dashes: (len) => `Pattern: Dashes (${len}x, Break/Separator)`,
                     underscores: (len) => `Pattern: Underscores (${len}x, Extended Break)`,
                     stars: (len) => `Pattern: Stars (${len}x, Agreement/Highlight)`,
                     exclamations: (len) => `Pattern: Exclamations (${len}x, Emphasis/Alert)`, // Note: !!! is also a structural key
                     dollars: (len) => `Pattern: Dollars (${len}x, Value Focus)`,
                     hashes: (len) => `Pattern: Hashes (${len}x, Comment/Metadata)`, // Note: # is also a core symbol
                     pipes: (len) => `Pattern: Pipes (${len}x, Delimiter/Alternation)`, // Sequences of single '|'
                     doublePipes: (len) => `Pattern: Double Pipes (${len}x, Obfuscation Marker)`, // Sequences of '||' or '‖'
                     otherRepeats: (len, char) => `Pattern: Repeating "${char}" (${len}x)` // Fallback
                 },

                // 4. Common Composite Patterns - Specific validated sequences of symbols/structures
                compositePatterns: {
                    // Meta-Language & Validation Patterns (Order is important!)
                    '[$?Confirmed]': 'User Action: Validation Confirmed',
                    '[$?SimulatedOutcome="🖥️"]': 'Simulation Assertion: Expected Outcome ProcessData (Success)', // Specific outcome assertion
                    '[$?SimulatedOutcome="🗑️"]': 'Simulation Assertion: Expected Outcome DiscardData (Failure)', // Specific outcome assertion
                     '[$?SimulatedOutcome="SendToPackaging"]': 'Simulation Assertion: Expected Outcome SendToPackaging', // Specific outcome assertion
                     '[$?SimulatedOutcome="RejectLine"]': 'Simulation Assertion: Expected Outcome RejectLine', // Specific outcome assertion
                     '[$?SimulatedOutcome="📤"]': 'Simulation Assertion: Expected Outcome Send Out', // Specific outcome assertion
                    '[$?SimulatedOutcome=?]': 'Simulation Assertion: Expected Outcome (Query Pending)', // Outcome to be filled by AI calc

                    'User_Confirmation_Validation_Successful ✅': 'User Action: Successful Validation (Detailed Label)', // User feedback label from a successful validation

                     // Common Dialogue Flow Sequences
                     '[] {}': 'Sequence: User Utterance/Turn then AI Response/Turn',
                     '{} []': 'Sequence: AI Utterance/Turn then User Response/Turn',

                    // Decision & Logic Syntax Patterns (Partial components or full mini-patterns)
                     'IF{} THEN⇒ ELSE⇒': 'Syntax: Complete Simple Decision Gate (Checks condition and branches)',
                    'ELSE IF{} THEN⇒': 'Syntax: Chained/Nested Decision Check (An alternative path check within a gate)', // As part of larger IF... ELSE IF...
                     'IF{} THEN⇒': 'Syntax: Decision Gate Start (Implicit ELSE follows)', // Shorter version if ELSE is implicitly next
                     'THEN⇒': 'Syntax: True Path Follows (Used within or after Gates/Handlers)', // Also standalone
                    'ELSE⇒': 'Syntax: False Path Follows (Used within Gates)', // Also standalone
                     'ON_EXIT: {': 'Syntax: Loop Exit Handler Block Start', // As part of LOOP structure
                     'MutateState :': 'Syntax: State Mutation Operation Start', // As part of Mutation Block

                     // Pattern Compositions representing Concepts (Validated Structures)
                    '< [] ≺≻ {} >': 'Validated Concept: Core Mutual Interaction (User-AI System Base)',
                     '< [] ⇒ ⏳ ⇒ {} >': 'Validated Concept: User State Evolves Temporally to AI Outcome State', // Common flow concept
                    '< < [] / { } > >': 'Validated Focus Structure: User/AI Interaction Core Frame', // Used in documentation/meta-lang
                     '< [] ∥ {} >': 'Validated Concept: User and AI Exist in Parallel (Concurrency/Option)',

                     // Common Action/Outcome Label Starts
                     '<Reason:': 'Outcome Label: Reason Follows (e.g. <Reason: NotEncrypted>)', // Used in output paths
                     '<Outcome:': 'Outcome Label: Outcome Follows (e.g. <Outcome: Success>)', // Used in output paths
                     '<State :': 'Syntax: State Definition/Reference (Starts <State : Name = Value> or <State : Name>)', // Used for item states
                     '<Location :': 'Syntax: Location Definition/Reference (Starts <Location : Name>)', // Used for item location
                     '<Item :': 'Syntax: Item Definition/Reference (Starts <Item : Name>)', // Used for item definition/reference

                    // Specific Co-evolved Patterns from Scenarios (Most complex validated patterns - Keep updated!)
                    '< SecureDataProcessing_Workflow_LinkingPattern >': 'Validated Linking Pattern: Full Scenario Workflow Connections (Outcome-Based)',
                     '< FileWorkflow_WithConditional :: [Doc] ⇒ 📝 ⇒ 📦 { [Doc] ~ {🏷️} } ⇒ IF {🏷️} THEN ⇒ 🖥️ ELSE ⇒ 🗑️ >': 'Validated Scenario: File Workflow (State-driven Conditional Routing)',
                    '< CoolingLoop :': 'Validated Process: Automated Cooling Loop Start', // Start of validated cooling loop structure
                    '< PostLoopCheck_Revised_V2 :': 'Validated Gate: Revised Cooling Post-Loop Check Start (Handles exit reasons)', // Start of validated check
                     '<CheckAuthentication_Process :': 'Validated Process: Auth Loop with Retries Start', // Start of Auth Loop process
                     '<ComplianceCheck_Process :': 'Validated Process: Compliance Check Gate Start', // Start of Compliance Gate
                     '<FinalGate_Process :': 'Validated Gate: Final Workflow Decision Gate Start', // Start of Final Gate
                     '< MutateState : LoopExitReason = ⏰ >': 'Validated Mutation: Set Exit Reason to Max Cycles Hit', // Specific validated mutation
                     '< MutateState : LoopExitReason = 📉 >': 'Validated Mutation: Set Exit Reason to Cooled OK', // Specific validated mutation
                     '< MutateState : Authenticated = EXTERNAL_RESULT >': 'Validated Mutation: Authenticated Status Updated Externally', // Specific validated mutation

                     // Composite logic blocks (Often within IF/UNTIL {} - need to parse this syntax within the `{}` block)
                     '( Temperature >': 'Logic Block: Temperature Greater Than (Grouped Condition Start)', // Starts a condition check part
                    '( Temperature <=': 'Logic Block: Temperature Less Than Or Equal To (Grouped Condition Start)',
                    '( LoopCounter >=': 'Logic Block: Loop Counter Greater Than Or Equal To (Grouped Condition Start)',
                    '( Authenticated =': 'Logic Block: Authenticated Equals (Grouped Condition Start)',
                    '( NOT': 'Logic Block: Logical NOT (Grouped Negation Start)',

                    // --- Ensure Raw Markers & simpler structures are later if they overlap ---
                    '---': 'Raw Marker: Section Separator', // Standard 3 dashes
                     '!!!': 'Raw Marker: High Alert/Emphasis', // Standard 3 exclamations

                    // Ensure single brackets and core symbols are lower precedence than fragments that start with them
                    '<': 'Core Symbol: Angle Bracket Start / Less Than Operator (Contextual)', // Matched *after* longer <XYZ>
                    '>': 'Core Symbol: Angle Bracket End / Greater Than Operator (Contextual)', // Matched *after* longer <XYZ>
                     '{': 'Core Symbol: Curly Brace Start / Block Start', // Matched *after* longer {XYZ : }
                    '}': 'Core Symbol: Curly Brace End / Block End', // Matched *after* longer {XYZ : }
                     '[': 'Core Symbol: Square Bracket Start / Item/List Start', // Matched *after* longer []
                    ']': 'Core Symbol: Square Bracket End / Item/List End', // Matched *after* longer []
                     '(': 'Core Symbol: Parenthesis Start / Grouping Start',
                     ')': 'Core Symbol: Parenthesis End / Grouping End',
                },

                // 5. Tags / States / Properties - Specific labels or key-value-like components.
                tagsAndStates: {
                    ':ValidationResponse': 'Tag: Validation Response',
                     ':StructuredValidationResponse': 'Tag: Structured Validation Response', // User pattern
                     ':Validation_Complete': 'Tag: Validation Complete',
                    ':FinalValidation_Complete': 'Tag: Final Validation Complete',
                     ':Rule_Documentation': 'Tag: Rule Documentation',
                    ':Specific_Logic_for_LoopExitReason_Tagging': 'Tag: Specific Logic for Loop Exit Reason Tagging', // ON_EXIT doc part
                    ':ON_EXIT_Handler': 'Tag: ON_EXIT Handler Definition',
                     ':ConditionStatusAccess': 'Tag: Loop Condition Status Access Mechanism', // ON_EXIT related doc part
                    ':Sims': 'Category Tag: Simulations',
                     ':LoopExitCauseHandler': 'Tag: Loop Exit Cause Handler Definition',
                     ':SimulatedOutcome': 'Tag: Simulated Outcome Assertion', // Used as a tag before '=' in composite
                     ':Outcome': 'Label: Outcome (Follows Gate/Process)',
                     ':Reason': 'Label: Reason (Follows Gate/Process)',
                    ':State': 'Label: State Definition',
                    ':Item': 'Label: Item Reference', // Used with <>
                     ':Location': 'Label: Location Reference', // Used with <>
                     ':Temperature': 'State Type: Temperature', // State Type
                     ':LoopCounter': 'State Type: Loop Counter', // State Type
                    ':LoopExitReason': 'State Type: Loop Exit Reason', // State Type
                    ':AuthAttempts': 'State Type: Authentication Attempts', // State Type
                    ':Encrypted': 'State Type: Encrypted Status', // State Type
                    ':Authenticated': 'State Type: Authenticated Status', // State Type
                     ':Compliant': 'State Type: Compliant Status', // State Type
                    ':Status': 'State Type: Overall Status', // State Type
                    ':Initial': 'Value: Initial State', // State Value
                    ':CooledOK': 'Reason Value: Successfully Cooled (📉)', // Maps the concept to value
                    ':MaxCyclesHit': 'Reason Value: Maximum Attempts Limit Reached (⏰)', // Maps the concept to value
                    ':MultiExit': 'Reason Value: Multiple Condition Exit (⁉️)', // Maps the concept to value
                     ':MaxAttempts_HitLimit': 'Reason Label Value: Max Attempts Hit Limit (Specific Fail)', // Used in {<Reason:...>}
                     ':StillHot_DidNotHitMaxLimit': 'Reason Label Value: Still Hot, Did Not Hit Max Limit (Specific Fail)', // Used in {<Reason:...>}
                     ':AuthMaxRetries_Failure': 'Reason Label Value: Auth Max Retries Failure (Specific Fail)', // Used in {<Reason:...>}
                     ':OtherFailure': 'Reason Label Value: Other Unspecified Failure', // Used in {<Reason:...>}
                     ':UnexpectedStateOrPath': 'Reason Label Value: Unexpected State or Path (Safety Fail)', // Used in {<Reason:...>}
                    ':Resolved': 'State: Issue is Resolved', // Sim5 issue fixed

                    // Validation Status Tags (from conversation)
                     ':Acknowledged': 'Status Tag: Acknowledged',
                    ':Rx': 'Status Tag: Received (Short)',
                    ':Confmd': 'Status Tag: Confirmed (Short)',
                    ':Recvd': 'Status Tag: Received (Short)',
                     ':Applied': 'State: Applied',
                     ':Active': 'State: Active / In Progress',
                     ':Begin': 'Action/State: Begin Phase',
                    ':Selected': 'State: Selected (Option Choice)',

                     ':IssueIdentified': 'Status Tag: Issue Identified', // Used in Meta context
                     ':LogicConsistency': 'Concept/Tag: Logical Consistency',

                    // Example concept-based tags (less strict lexicon)
                     ':Contained': 'Status Tag: Is Contained', // Implicit use often
                     ':Composition': 'Tag: Composition / Combined Elements',
                     ':Evaluation': 'Tag: Evaluation Process/Result',
                     ':Proposition': 'Tag: Proposition / Suggestion',
                },

                // 6. Natural Language Keywords/Phrases -> SS Pattern/Symbol Mapping
                nlMap: {
                    // --- Order longest common phrases/mappings FIRST ---
                    'user state: strong disagreement / resolute refusal': '[____________!!!!]',
                     'i strongly disagree': '[____________!!!!]',
                     'translate full scenario verbal to ss logic': 'Translate_FullScenario_VerbalToSS', // Map user command phrase
                    'validate proposed revised on_exit handler logic attempt 3': 'Validate_Revised_ON_EXIT_Handler_Attempt3', // Map user command phrase
                    'rerun sim 5 with revised on_exit logic': 'ReRun_Sim5_withRevisedON_EXIT', // Map user command phrase
                    're-run sim 5 with revised on_exit logic': 'ReRun_Sim5_withRevisedON_EXIT',
                     'translate complex requirement to logic': 'Translate_ComplexRequirement_toLogic', // Map user command phrase
                    'sim pattern using precise syntax': 'Sim_Pattern_UsingPreciseSyntax', // Map user command phrase
                     'formalize top level syntax mapping': 'Formalize_TopLevel_SyntaxMapping !', // Map user command phrase, retain emphasis
                    'define syntax precise nested structure': 'DefineSyntax_PreciseNestedStructure', // Map user command phrase
                    'ai attempts new interpretation': 'AI_Attempts_NewInterpretation ?', // Map user command phrase, retain query
                     'define syntax nested check logic': 'DefineSyntax_NestedCheckLogic', // Map user command phrase
                    'define precedence rules': 'Define_PrecedenceRules', // Map user command phrase
                    'sim more complex nesting with or not': 'Sim_Deeper_Nesting_ComplexLogic', // Map user command phrase
                    'simulate deeper nesting complex logic': 'Sim_Deeper_Nesting_ComplexLogic', // Map user command phrase (simpler)
                     'sim nested depth 3': 'Sim_NestedDepth_3', // Specific sim name (useful for referring)
                    'sim precisely logic 1': 'Sim_PreciseLogic_1', // Specific sim name
                     'sim precise logic 2': 'Sim_PreciseLogic_2', // Specific sim name
                    'sim precise logic 3': 'Sim_PreciseLogic_3', // Specific sim name

                    'test cooling system edge cases': 'Test_CoolingSystem_EdgeCases !', // Map user command phrase, retain emphasis
                    'rerun sim 5 final validation': 'ReRun_Sim5_FINAL_Validation ! !', // Map user command phrase, retain double emphasis
                     'build auto loop until temp ok': 'Build_AutoLoop_Until_Temp_OK !', // Map user command phrase, retain emphasis
                     'add loop cycle counter to prevent stall': 'Add_LoopCycleCounter_to_Prevent_Stall !', // Map user command phrase, retain emphasis
                     'add alert flag if max cycles hit': 'Add_AlertFlag_if_MaxCyclesHit !', // Map user command phrase, retain emphasis
                     'validate revised on_exit handler': 'Validate_Revised_ON_EXIT_Handler !', // Map user command phrase, retain emphasis
                    'rerun sim 5 with revised on_exit': 'ReRun_Sim5_withRevisedON_EXIT !', // Map user command phrase, retain emphasis
                    'apply validated logic to new scenario': 'Apply_ValidatedLogic_toNewScenario ?', // Map user command phrase, retain query
                     'translate workday': 'TranslateWorkday', // Map user command phrase (early)
                    'implement weekend routine': 'ImplementWeekendRoutine', // Map user command phrase (early)
                    'explore specific state': 'Explore_Specific_State', // Map user command phrase (early)
                    'define spaces': 'DefineSpaces', // Map user command phrase (early)
                    'activate synthesize': 'Activate_Synthesize', // Map user command phrase (early)
                    'add temp sensor state mutation in cool down unit': 'Add_TempSensorStateMutation_in_CoolDownUnit !', // Map user command phrase, retain emphasis

                     // -- Common SS Structural/Conceptual Patterns --
                    'user turn then ai': '[] {}', // Direct mapping of simple flow
                     'ai turn then user': '{} []', // Direct mapping of simple flow
                    'user interaction with ai': '< [] ≺≻ {} >', // Maps a core concept
                     'ai acknowledges ok': '{ok}', // Maps specific AI feedback phrase
                     'user queries evaluation': '[$?]', // Standard user action pattern
                    'evaluate this': '[$?]',
                     'needs reprocessing': '[!]', // Standard user state pattern

                    // --- Basic Concepts ---
                    'user container': '[]',
                    'ai container': '{}',
                    'conceptual frame': '< >',
                    'grouping structure': '()', // Maps ( )
                     'flow leads to': '⇒',
                    'directional flow': '⇒',
                    'mutual interaction': '≺≻',
                    'exchange interaction': '≺≻',
                     'parallel flow': '∥',
                     'alternative link': '∥',
                     'internal modifier': '~',
                     'association link': '~',
                    'temporal marker': '⏳',
                    'combination symbol': '+',
                    'addition symbol': '+',
                    'synthesis symbol': '+',
                     'comment marker': '#', // '#' core symbol
                     'definition marker': ':', // ':' core symbol
                     'query indicator': '?', // '?' core symbol
                    'emphasis marker': '!', // '!' core symbol
                     'acknowledgement marker': '*', // '*' core symbol
                     'confirmation marker': '✓', // '✓' core symbol

                    // -- State/Tag Names (Often appear after ':') --
                     ':Acknowledged': 'Status Tag: Acknowledged', // Tag
                    ':Confirmed': 'Status Tag: Confirmed', // Tag
                    ':Validated': 'Status Tag: Validated', // Tag
                    ':Valid': 'Status Tag: Valid (Short form)', // Tag
                     ':Evaluation': 'Tag: Evaluation', // Tag
                    ':Simulated': 'Tag: Simulated', // Tag
                    ':Success': 'Value/Label: Success', // Value/Label
                     ':Failure': 'Value/Label: Failure', // Value/Label
                    ':Temperature': 'State Type: Temperature', // State Type
                     ':LoopCounter': 'State Type: Loop Counter', // State Type
                    ':LoopExitReason': 'State Type: Loop Exit Reason', // State Type
                    ':AuthAttempts': 'State Type: Authentication Attempts', // State Type
                    ':Encrypted': 'State Type: Encrypted Status', // State Type
                    ':Authenticated': 'State Type: Authenticated Status', // State Type
                     ':Compliant': 'State Type: Compliant Status', // State Type
                    ':Status': 'State Type: Overall Status', // State Type
                    ':Initial': 'Value: Initial State', // State Value
                    ':CooledOK': 'Reason Value: Successfully Cooled (📉)', // Maps the concept to value
                    ':MaxCyclesHit': 'Reason Value: Maximum Attempts Limit Reached (⏰)', // Maps the concept to value
                    ':MultiExit': 'Reason Value: Multiple Condition Exit (⁉️)', // Maps the concept to value
                     ':MaxAttempts_HitLimit': 'Reason Label Value: Max Attempts Hit Limit (Specific Fail)', // Used in {<Reason:...>}
                     ':StillHot_DidNotHitMaxLimit': 'Reason Label Value: Still Hot, Did Not Hit Max Limit (Specific Fail)', // Used in {<Reason:...>}
                     ':AuthMaxRetries_Failure': 'Reason Label Value: Auth Max Retries Failure (Specific Fail)', // Used in {<Reason:...>}
                     ':OtherFailure': 'Reason Label Value: Other Unspecified Failure', // Used in {<Reason:...>}
                     ':UnexpectedStateOrPath': 'Reason Label Value: Unexpected State or Path (Safety Fail)', // Used in {<Reason:...>}
                    ':Resolved': 'State: Issue is Resolved', // Sim5 issue fixed

                    // Validation Status Tags (from conversation)
                     ':Acknowledged': 'Status Tag: Acknowledged',
                    ':Rx': 'Status Tag: Received (Short)',
                    ':Confmd': 'Status Tag: Confirmed (Short)',
                    ':Recvd': 'Status Tag: Received (Short)',
                     ':Applied': 'State: Applied',
                     ':Active': 'State: Active / In Progress',
                     ':Begin': 'Action/State: Begin Phase',
                    ':Selected': 'State: Selected (Option Choice)',

                     ':IssueIdentified': 'Status Tag: Issue Identified', // Used in Meta context
                     ':LogicConsistency': 'Concept/Tag: Logical Consistency',

                    // Example concept-based tags (less strict lexicon)
                     ':Contained': 'Status Tag: Is Contained', // Implicit use often
                     ':Composition': 'Tag: Composition / Combined Elements',
                     ':Evaluation': 'Tag: Evaluation Process/Result',
                     ':Proposition': 'Tag: Proposition / Suggestion',
                }
            },

            // Sorted keys for efficient matching
            sortedSSPatternKeys: [], // Stores { key: string, type: string } objects for SS -> NL lookup.
            sortedNLKeys: [], // Stores string keys (nl phrases) for NL -> SS lookup.

            // --- Common patterns for visual builder ---
            commonPatterns: [
                // Common patterns from state.commonPatterns...
                // ... (add existing common patterns here)
                 {
                     id: 'user-ai-interaction',
                     name: 'User-AI Interaction',
                     pattern: '< [] ≺≻ {} >',
                     description: 'Basic bidirectional interaction between user and AI'
                 },
                 {
                     id: 'user-to-ai-flow',
                     name: 'User to AI Flow',
                     pattern: '[] ⇒ {}',
                     description: 'User input leads to AI response'
                 },
                 {
                     id: 'ai-to-user-flow',
                     name: 'AI to User Flow',
                     pattern: '{} ⇒ []',
                     description: 'AI output leads to user response'
                 },
                 {
                     id: 'user-evaluation',
                     name: 'User Evaluation Request',
                     pattern: '[$?]',
                     description: 'User requesting evaluation or assessment'
                 },
                 {
                     id: 'user-emphasis',
                     name: 'User Emphasis',
                     pattern: '[!]',
                     description: 'User emphasizing something important'
                 },
                 {
                     id: 'simple-conditional',
                     name: 'Simple Conditional',
                     pattern: 'IF{} THEN⇒ ELSE⇒',
                     description: 'Basic conditional logic structure'
                 },
                 {
                     id: 'state-mutation',
                     name: 'State Mutation',
                     pattern: 'MutateState : State = Value',
                     description: 'Changes a state value in the system'
                 },
                 {
                     id: 'simple-loop',
                     name: 'Simple Loop',
                     pattern: 'LOOP UNTIL {} : { }',
                     description: 'Repeats a process until condition is met'
                 }

            ],

            // --- Symbol groups for palette ---
            symbolGroups: {
                core: [
                    { symbol: '[]', description: 'User Container' },
                    { symbol: '{}', description: 'AI Container' },
                    { symbol: '<>', description: 'Conceptual Frame' },
                    { symbol: '()', description: 'Grouping/Sub-context' }
                ],
                flow: [
                    { symbol: '⇒', description: 'Directional Flow' },
                    { symbol: '≺≻', description: 'Mutual Interaction' },
                    { symbol: '∥', description: 'Parallel Flow' },
                    { symbol: '~', description: 'Association Link' },
                    { symbol: '@', description: 'Location Relation' }
                ],
                structure: [
                    { symbol: 'IF{', description: 'Conditional Start' },
                    { symbol: 'THEN⇒', description: 'True Path' },
                    { symbol: 'ELSE⇒', description: 'False Path' },
                    { symbol: 'LOOP UNTIL', description: 'Loop Start' },
                    { symbol: 'ON_EXIT:', description: 'Exit Handler' }
                ],
                states: [
                    { symbol: '✅', description: 'Success' },
                    { symbol: '❌', description: 'Failure' },
                    { symbol: '📝', description: 'Scratchpad' },
                    { symbol: '📦', description: 'Archive' },
                    { symbol: '🖥️', description: 'Presentation' },
                    { symbol: '🗑️', description: 'Discard' }
                ],
                logic: [
                    { symbol: '=', description: 'Equals' },
                    { symbol: '>', description: 'Greater Than' },
                    { symbol: '<', description: 'Less Than' },
                    { symbol: '&', description: 'AND' },
                    { symbol: '|', description: 'OR' },
                    { symbol: '¬', description: 'NOT' }
                ]
            },

            // --- Auto-complete suggestions ---
            autocompleteSuggestions: {
                'IF': ['IF{}', 'IF{} THEN⇒', 'IF{} THEN⇒ ELSE⇒'],
                'LOOP': ['LOOP UNTIL', 'LOOP UNTIL {}'],
                'Mutate': ['MutateState :', 'MutateState : State = Value'],
                '[': ['[]', '[$?]', '[!]'],
                '{': ['{}', '{ok}'],
                '<': ['<>', '< [] ≺≻ {} >', '< [] ⇒ {} >'],
                '(': ['()'],
                ':': [':Confirmed', ':Validated', ':State', ':Item']
            },

            // Event handler bound references for proper removal in removeEventListeners
            _boundHandleToggleChange: null,
            _boundPerformTranslation: null,
            _boundInsertPattern: null,
            _boundInsertSymbol: null,
            _boundSwitchSymbolCategory: null, // For symbol categories in Translate tab
            _handleInputChangeBound: null,
            _handleInputKeydownBound: null,
            _handleTranslateKeypressBound: null, // Ctrl+Enter translate
            _handleCaretClickBound: null,
            _handleCaretKeyupBound: null,
            _handleBuilderDragOverBound: null, // For builder canvas
            _handleBuilderDragLeaveBound: null, // For builder canvas
            _handleBuilderDropBound: null, // For builder canvas
             _handleComponentDragStartBound: null, // For builder components - manage via delegation or bind/unbind
            _handlePatternsInputBound: null, // For patterns search input
             _handlePatternsListClickBound: null, // For patterns list item clicks (preview) and button clicks (use)
            _documentClickListenerBound: null, // For hiding suggestions/help on document click outside
            _documentMouseOverListenerBound: null, // For symbol tooltips on document mouseover (delegation)
            _documentMouseOutListenerBound: null,  // For symbol tooltips on document mouseout (delegation)

            _autoCompleteActive: false,
            _autoCompleteTimeout: null,
            _lastCaretPosition: 0,

            _resizeObserver: null // Reference to ResizeObserver instance

        },


        /**
         * Lifecycle Method: Called when the component is initially loaded or registered.
         * Renders basic UI structure and defers complex event handling until panel open.
         */
        initialize: function() {
            this.dom.content = document.getElementById(`${this.id}-content`);
            if (!this.dom.content) {
                console.error(`[${this.id}] Initialization Error: Content element #${this.id}-content not found.`);
                return;
            }

            this.prepareSortedKeys(); // Prepare lexicon keys

            // Render the UI structure, but do NOT attach most event listeners for interactivity
            this.renderUI();

            // Add necessary CSS styles globally (these are not panel-specific interactive styles)
            this.addStyles();

            // Initialize passive UI elements (like global tooltip DOM element) ONCE when component is registered
            this.initPassiveUIElements();

            // Initial UI update based on default state (e.g., showing SS->NL toggle correctly)
            this.updateLabelsAndStyling();

            console.log(`[${this.id}] Initialization complete. Complex listeners deferred until panel open.`);
        },

        /**
         * Prepares sorted keys from lexicon data for efficient pattern matching
         * This is crucial for translation functions.
         */
        prepareSortedKeys: function() {
            console.log(`[${this.id}] Preparing sorted lexicon keys for pattern matching...`);
            
            // Initialize arrays
            this.state.sortedSSPatternKeys = [];
            this.state.sortedNLKeys = [];
            
            // Process composite patterns (longest first)
            Object.keys(this.state.lexicon.compositePatterns).forEach(key => {
                this.state.sortedSSPatternKeys.push({ key, type: 'composite' });
            });
            
            // Process structural elements
            Object.keys(this.state.lexicon.structuralElements).forEach(key => {
                this.state.sortedSSPatternKeys.push({ key, type: 'structural' });
            });
            
            // Process tags and states
            Object.keys(this.state.lexicon.tagsAndStates).forEach(key => {
                this.state.sortedSSPatternKeys.push({ key, type: 'tag' });
            });
            
            // Process core symbols
            Object.keys(this.state.lexicon.coreSymbols).forEach(key => {
                this.state.sortedSSPatternKeys.push({ key, type: 'core' });
            });
            
            // Sort SS pattern keys by length (longest first for greedy matching)
            this.state.sortedSSPatternKeys.sort((a, b) => b.key.length - a.key.length);
            
            // Process NL mapping (sorted by length for greedy matching)
            this.state.sortedNLKeys = Object.keys(this.state.lexicon.nlMap).sort((a, b) => b.length - a.length);
            
            console.log(`[${this.id}] Lexicon keys prepared: ${this.state.sortedSSPatternKeys.length} SS patterns, ${this.state.sortedNLKeys.length} NL phrases`);
        },

        /**
         * Initialize passive UI elements like tooltips
         */
        initPassiveUIElements: function() {
            // Create tooltip element only ONCE if it doesn't already exist
            if (!this.state._tooltipElement || !document.body.contains(this.state._tooltipElement)) {
               this.state._tooltipElement = document.createElement('div');
               this.state._tooltipElement.className = `${this.id}-tooltip`;
               this.state._tooltipElement.style.display = 'none'; // Hidden by default
               document.body.appendChild(this.state._tooltipElement); // Add to body (needed for position)
               console.log(`[${this.id}] Tooltip DOM element created.`);
            }
        },

        /**
         * Render the component UI structure
         */
        renderUI: function() {
            if (!this.dom.content) return;
            
            const container = document.createElement('div');
            container.className = `${this.id}-container`;
            
            // Create tab navigation
            const tabNav = document.createElement('div');
            tabNav.className = `${this.id}-tabs`;
            
            const tabs = [
                { id: 'translate', label: 'Translate', icon: '🔄' },
                { id: 'builder', label: 'Visual Builder', icon: '🧩' },
                { id: 'patterns', label: 'Patterns', icon: '📝' }
            ];
            
            tabs.forEach((tab, index) => {
                const tabButton = document.createElement('button');
                tabButton.className = `${this.id}-tab-button ${index === 0 ? 'active' : ''}`;
                tabButton.setAttribute('data-tab', tab.id);
                tabButton.innerHTML = `<span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span>`;
                tabButton.addEventListener('click', () => this.switchTab(tab.id));
                tabNav.appendChild(tabButton);
            });
            
            container.appendChild(tabNav);
            
            // Create tab content areas
            const tabContent = document.createElement('div');
            tabContent.className = `${this.id}-tab-content`;
            
            // Create Translate Tab
            const translateTab = this.createTranslateTab();
            translateTab.className = `${this.id}-tab-pane ${this.id}-translate-tab active`;
            translateTab.setAttribute('data-tab', 'translate');
            tabContent.appendChild(translateTab);
            
            // Create Visual Builder Tab
            const builderTab = this.createVisualBuilderTab();
            builderTab.className = `${this.id}-tab-pane ${this.id}-builder-tab`;
            builderTab.setAttribute('data-tab', 'builder');
            builderTab.style.display = 'none';
            tabContent.appendChild(builderTab);
            
            // Create Patterns Tab
            const patternsTab = this.createPatternsTab();
            patternsTab.className = `${this.id}-tab-pane ${this.id}-patterns-tab`;
            patternsTab.setAttribute('data-tab', 'patterns');
            patternsTab.style.display = 'none';
            tabContent.appendChild(patternsTab);
            
            container.appendChild(tabContent);
            
            this.dom.content.innerHTML = '';
            this.dom.content.appendChild(container);
            
            // Check if the container has rendered, and if DOM elements are accessible
            if (!document.querySelector(`.${this.id}-container`)) {
                console.error(`[${this.id}] Container didn't render properly`);
            }
        },

        /**
         * Create the translate tab content
         */
        createTranslateTab: function() {
            const tab = document.createElement('div');
            
            // Direction toggle
            const directionToggleContainer = document.createElement('div');
            directionToggleContainer.className = 'direction-toggle-container';
            
            const directionLabel = document.createElement('span');
            directionLabel.className = 'direction-label';
            // Will be set in updateLabelsAndStyling
            this.dom.directionLabelSpan = directionLabel;
            
            const toggleContainer = document.createElement('label');
            toggleContainer.className = 'toggle-switch';
            
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.checked = !this.state.translateSS_to_NL; // Inverse of SS->NL
            toggleInput.className = 'direction-toggle';
            this.dom.directionToggle = toggleInput;
            
            const toggleSlider = document.createElement('span');
            toggleSlider.className = 'slider';
            
            toggleContainer.appendChild(toggleInput);
            toggleContainer.appendChild(toggleSlider);
            
            directionToggleContainer.appendChild(directionLabel);
            directionToggleContainer.appendChild(toggleContainer);
            
            // Info and help button
            const infoButton = document.createElement('button');
            infoButton.className = 'info-button';
            infoButton.innerHTML = 'ℹ️';
            infoButton.title = 'Show help';
            infoButton.setAttribute('data-handler', 'showHelp');
            
            directionToggleContainer.appendChild(infoButton);
            
            tab.appendChild(directionToggleContainer);
            
            // Input area
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-container';
            
            const inputLabel = document.createElement('label');
            inputLabel.className = 'input-label';
            // Will be set in updateLabelsAndStyling
            this.dom.inputLabel = inputLabel;
            
            const inputArea = document.createElement('textarea');
            inputArea.className = 'input-area';
            inputArea.placeholder = ''; // Will be set in updateLabelsAndStyling
            inputArea.rows = 5;
            this.dom.inputArea = inputArea;
            
            inputContainer.appendChild(inputLabel);
            inputContainer.appendChild(inputArea);
            
            // Symbol palette for SS->NL direction
            const symbolPalette = document.createElement('div');
            symbolPalette.className = 'symbol-palette';
            this.dom.symbolPalette = symbolPalette;
            
            // Symbol categories
            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'symbol-categories';
            
            this.state.symbolCategories.forEach(category => {
                const categoryButton = document.createElement('button');
                categoryButton.className = `${this.id}-symbol-category ${category.id === this.state.currentSymbolCategory ? 'active' : ''}`;
                categoryButton.setAttribute('data-category', category.id);
                categoryButton.setAttribute('data-handler', 'switchSymbolCategory');
                categoryButton.innerHTML = `<span>${category.icon}</span> <span>${category.name}</span>`;
                categoryContainer.appendChild(categoryButton);
            });
            
            symbolPalette.appendChild(categoryContainer);
            
            // Symbol buttons
            const symbolButtonsContainer = document.createElement('div');
            symbolButtonsContainer.className = 'symbol-buttons';
            
            // Populate initial symbols for the default category
            const initialCategory = this.state.currentSymbolCategory;
            if (this.state.symbolGroups[initialCategory]) {
                this.state.symbolGroups[initialCategory].forEach(item => {
                    const button = document.createElement('button');
                    button.className = `${this.id}-symbol-button`;
                    button.setAttribute('data-symbol', item.symbol);
                    button.setAttribute('title', item.description);
                    button.setAttribute('data-handler', 'insertSymbol');
                    button.textContent = item.symbol;
                    symbolButtonsContainer.appendChild(button);
                });
            }
            
            symbolPalette.appendChild(symbolButtonsContainer);
            inputContainer.appendChild(symbolPalette);
            
            tab.appendChild(inputContainer);
            
            // Translate button
            const translateButtonContainer = document.createElement('div');
            translateButtonContainer.className = 'translate-button-container';
            
            const translateButton = document.createElement('button');
            translateButton.className = 'translate-button';
            translateButton.innerHTML = '🔄 Translate';
            this.dom.translateButton = translateButton;
            
            translateButtonContainer.appendChild(translateButton);
            tab.appendChild(translateButtonContainer);
            
            // Output area
            const outputContainer = document.createElement('div');
            outputContainer.className = 'output-container';
            
            const outputLabelContainer = document.createElement('div');
            outputLabelContainer.className = 'output-label-container';
            
            const outputLabel = document.createElement('label');
            outputLabel.className = 'output-label';
            // Will be set in updateLabelsAndStyling
            this.dom.outputLabel = outputLabel;
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = '📋';
            copyButton.title = 'Copy to clipboard';
            copyButton.setAttribute('data-handler', 'copyOutputToClipboard');
            
            outputLabelContainer.appendChild(outputLabel);
            outputLabelContainer.appendChild(copyButton);
            
            const outputArea = document.createElement('textarea');
            outputArea.className = 'output-area';
            outputArea.placeholder = ''; // Will be set in updateLabelsAndStyling
            outputArea.rows = 7;
            outputArea.readOnly = true;
            this.dom.outputArea = outputArea;
            
            outputContainer.appendChild(outputLabelContainer);
            outputContainer.appendChild(outputArea);
            
            tab.appendChild(outputContainer);
            
            // Suggestions area
            const suggestionArea = document.createElement('div');
            suggestionArea.className = 'suggestion-area';
            suggestionArea.style.display = 'none';
            this.dom.suggestionArea = suggestionArea;
            
            tab.appendChild(suggestionArea);
            
            return tab;
        },

        /**
         * Create the visual builder tab content
         */
        createVisualBuilderTab: function() {
            const tab = document.createElement('div');
            
            // Builder header
            const builderHeader = document.createElement('div');
            builderHeader.className = 'builder-header';
            
            const builderTitle = document.createElement('h3');
            builderTitle.className = 'builder-title';
            builderTitle.textContent = 'Visual SS Pattern Builder';
            
            builderHeader.appendChild(builderTitle);
            tab.appendChild(builderHeader);
            
            // Builder content
            const builderContent = document.createElement('div');
            builderContent.className = 'builder-content';
            
            // Component palette categories
            const builderCategories = document.createElement('div');
            builderCategories.className = 'builder-categories';
            
            const categories = [
                { id: 'basic', name: 'Basic', icon: '📌' },
                { id: 'flow', name: 'Flow', icon: '⇒' },
                { id: 'logic', name: 'Logic', icon: '🔄' },
                { id: 'states', name: 'States', icon: '📊' }
            ];
            
            categories.forEach(category => {
                const categoryButton = document.createElement('button');
                categoryButton.className = `${this.id}-builder-category ${category.id === 'basic' ? 'active' : ''}`;
                categoryButton.setAttribute('data-category', category.id);
                categoryButton.setAttribute('data-handler', 'switchBuilderCategory');
                categoryButton.innerHTML = `<span>${category.icon}</span> <span>${category.name}</span>`;
                builderCategories.appendChild(categoryButton);
            });
            
            // Builder palette
            const builderPalette = document.createElement('div');
            builderPalette.className = `${this.id}-builder-palette`;
            
            // Initial components for basic category
            const basicComponents = [
                { id: 'user-container', label: 'User Container', value: '[]', type: 'container' },
                { id: 'ai-container', label: 'AI Container', value: '{}', type: 'container' },
                { id: 'conceptual-frame', label: 'Conceptual Frame', value: '<>', type: 'container' },
                { id: 'grouping', label: 'Grouping', value: '()', type: 'container' }
            ];
            
            basicComponents.forEach(component => {
                const comp = document.createElement('div');
                comp.className = `${this.id}-builder-component`;
                comp.id = component.id;
                comp.setAttribute('draggable', 'true');
                comp.setAttribute('data-value', component.value);
                comp.setAttribute('data-type', component.type);
                comp.textContent = component.label;
                builderPalette.appendChild(comp);
            });
            
            // Builder canvas
            const builderCanvas = document.createElement('div');
            builderCanvas.className = 'builder-canvas';
            builderCanvas.innerHTML = '<div class="builder-placeholder">Drag components here to build your pattern</div>';
            
            // Builder output
            const builderOutput = document.createElement('div');
            builderOutput.className = 'builder-output';
            
            const outputLabel = document.createElement('div');
            outputLabel.className = 'builder-output-label';
            outputLabel.textContent = 'Generated Pattern:';
            
            const outputValue = document.createElement('div');
            outputValue.className = 'builder-output-value';
            outputValue.textContent = '';
            
            builderOutput.appendChild(outputLabel);
            builderOutput.appendChild(outputValue);
            
            // Action buttons
            const actionButtons = document.createElement('div');
            actionButtons.className = 'action-buttons';
            
            const clearButton = document.createElement('button');
            clearButton.className = 'clear-button';
            clearButton.textContent = 'Clear';
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.textContent = 'Copy';
            
            const useButton = document.createElement('button');
            useButton.className = 'use-button';
            useButton.textContent = 'Use in Translator';
            
            actionButtons.appendChild(clearButton);
            actionButtons.appendChild(copyButton);
            actionButtons.appendChild(useButton);
            
            // Store references to builder elements
            this.dom.visualBuilder = {
                canvas: builderCanvas,
                output: outputValue,
                components: builderPalette
            };
            
            // Assemble the builder content
            builderContent.appendChild(builderCategories);
            builderContent.appendChild(builderPalette);
            builderContent.appendChild(builderCanvas);
            builderContent.appendChild(builderOutput);
            builderContent.appendChild(actionButtons);
            
            tab.appendChild(builderContent);
            
            return tab;
        },

        /**
         * Create the patterns tab content
         */
        createPatternsTab: function() {
            const tab = document.createElement('div');
            
            // Patterns header
            const patternsHeader = document.createElement('div');
            patternsHeader.className = 'patterns-header';
            
            const patternsTitle = document.createElement('h3');
            patternsTitle.className = 'patterns-title';
            patternsTitle.textContent = 'Common SS Patterns';
            
            patternsHeader.appendChild(patternsTitle);
            tab.appendChild(patternsHeader);
            
            // Search and filter
            const searchContainer = document.createElement('div');
            searchContainer.className = 'patterns-search-container';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'patterns-search';
            searchInput.placeholder = 'Search patterns...';
            
            searchContainer.appendChild(searchInput);
            tab.appendChild(searchContainer);
            
            // Patterns list
            const patternsListContainer = document.createElement('div');
            patternsListContainer.className = 'patterns-list-container';
            
            const patternsList = document.createElement('div');
            patternsList.className = 'patterns-list';
            
            // Group patterns by category
            const categories = {
                'basic': { name: 'Basic Structures', patterns: [] },
                'flow': { name: 'Flow Patterns', patterns: [] },
                'logic': { name: 'Logic Structures', patterns: [] }
            };
            
            // Sort patterns into categories
            this.state.commonPatterns.forEach(pattern => {
                if (pattern.pattern.includes('⇒') || pattern.pattern.includes('≺≻') || pattern.pattern.includes('∥')) {
                    categories.flow.patterns.push(pattern);
                } else if (pattern.pattern.includes('IF') || pattern.pattern.includes('LOOP') || pattern.pattern.includes('Mutate')) {
                    categories.logic.patterns.push(pattern);
                } else {
                    categories.basic.patterns.push(pattern);
                }
            });
            
            // Create pattern categories and items
            Object.entries(categories).forEach(([categoryId, category]) => {
                const categorySection = document.createElement('div');
                categorySection.className = 'pattern-category';
                
                const categoryHeader = document.createElement('div');
                categoryHeader.className = `${this.id}-pattern-category-header`;
                categoryHeader.setAttribute('data-category', categoryId);
                categoryHeader.innerHTML = `<span class="category-icon">▼</span> ${category.name}`;
                
                const categoryPatterns = document.createElement('div');
                categoryPatterns.className = 'pattern-category-items';
                
                category.patterns.forEach(pattern => {
                    const patternItem = document.createElement('div');
                    patternItem.className = `${this.id}-pattern-item`;
                    patternItem.setAttribute('data-pattern-id', pattern.id);
                    
                    const patternCode = document.createElement('code');
                    patternCode.className = `${this.id}-pattern-code`;
                    patternCode.textContent = pattern.pattern;
                    
                    const patternName = document.createElement('div');
                    patternName.className = 'pattern-name';
                    patternName.textContent = pattern.name;
                    
                    const useButton = document.createElement('button');
                    useButton.className = 'use-pattern-button';
                    useButton.textContent = 'Use';
                    
                    patternItem.appendChild(patternCode);
                    patternItem.appendChild(patternName);
                    patternItem.appendChild(useButton);
                    
                    categoryPatterns.appendChild(patternItem);
                });
                
                categorySection.appendChild(categoryHeader);
                categorySection.appendChild(categoryPatterns);
                patternsList.appendChild(categorySection);
            });
            
            patternsListContainer.appendChild(patternsList);
            tab.appendChild(patternsListContainer);
            
            // Pattern preview
            const previewContainer = document.createElement('div');
            previewContainer.className = 'pattern-preview-container';
            
            const previewHeader = document.createElement('div');
            previewHeader.className = 'preview-header';
            previewHeader.textContent = 'Pattern Details';
            
            const previewContent = document.createElement('div');
            previewContent.className = 'preview-content';
            previewContent.innerHTML = '<div class="preview-placeholder">Select a pattern to see details</div>';
            
            previewContainer.appendChild(previewHeader);
            previewContainer.appendChild(previewContent);
            tab.appendChild(previewContainer);
            
            // Store references
            this.dom.commonPatterns = {
                search: searchInput,
                list: patternsList,
                preview: previewContent
            };
            
            return tab;
        },

        /**
         * Switch between tabs
         */
        switchTab: function(tabId) {
            // Get all tab buttons and panes
            const tabButtons = document.querySelectorAll(`.${this.id}-tab-button`);
            const tabPanes = document.querySelectorAll(`.${this.id}-tab-pane`);
            
            // Hide all tab panes and remove active class from buttons
            tabPanes.forEach(pane => pane.style.display = 'none');
            tabButtons.forEach(button => button.classList.remove('active'));
            
            // Show the selected tab pane and set active class on button
            const selectedPane = document.querySelector(`.${this.id}-tab-pane[data-tab="${tabId}"]`);
            const selectedButton = document.querySelector(`.${this.id}-tab-button[data-tab="${tabId}"]`);
            
            if (selectedPane && selectedButton) {
                selectedPane.style.display = 'block';
                selectedButton.classList.add('active');
                
                // Additional actions when switching to a specific tab
                if (tabId === 'translate') {
                    // Focus input area when switching to translate tab
                    setTimeout(() => this.dom.inputArea?.focus(), 100);
                }
            }
        },

        /**
         * Handles the logic for setting up *all* event listeners used by this component.
         * This function is called *only* from the `onPanelOpen` lifecycle method.
         */
        addEventListeners: function() {
             console.log(`[${this.id}] Attaching event listeners (panel opened)...`);

             // --- Translate Tab Listeners ---
             const translateTabContent = this.dom.content?.querySelector(`.${this.id}-translate-tab`);
             if (translateTabContent) {

                 // Input area listeners (Delegated or Direct, prefers Direct for complex inputs)
                 const inputArea = this.dom.inputArea; // Use the cached reference
                if (inputArea) {
                     this.state._handleInputChangeBound = this.handleInputChange.bind(this); // Bind and store for removal
                     this.state._handleInputKeydownBound = this.handleInputKeydown.bind(this); // Bind and store for removal
                     this.state._handleTranslateKeypressBound = (e) => { 
                        if (e.key === 'Enter' && e.ctrlKey) { 
                            e.preventDefault(); 
                            this.performTranslation(); 
                        } 
                     }; // Inline + store
                     
                     this.state._handleCaretClickBound = () => { 
                        this.state._lastCaretPosition = inputArea.selectionStart; 
                     }; // Inline + store
                     
                     this.state._handleCaretKeyupBound = (e) => { // Inline + store
                        // Exclude arrow keys to prevent conflicts with suggestion navigation
                         if (![37, 38, 39, 40].includes(e.keyCode)) {
                             this.state._lastCaretPosition = inputArea.selectionStart;
                         }
                     };

                     inputArea.addEventListener('input', this.state._handleInputChangeBound);
                     inputArea.addEventListener('keydown', this.state._handleInputKeydownBound);
                     inputArea.addEventListener('keypress', this.state._handleTranslateKeypressBound);
                     inputArea.addEventListener('click', this.state._handleCaretClickBound);
                     inputArea.addEventListener('keyup', this.state._handleCaretKeyupBound);
                    console.log(`[${this.id}] Translate input area listeners attached.`);
                } else { console.warn(`[${this.id}] Translate inputArea not found for listeners.`);}


                 // Translate button (Direct listener)
                 const translateButton = this.dom.translateButton; // Use the cached reference
                if (translateButton) {
                     this.state._boundPerformTranslation = this.performTranslation.bind(this); // Bind and store
                     translateButton.addEventListener('click', this.state._boundPerformTranslation);
                    console.log(`[${this.id}] Translate button listener attached.`);
                } else { console.warn(`[${this.id}] TranslateButton not found for listeners.`);}


                 // Direction Toggle (Direct listener)
                 const directionToggle = this.dom.directionToggle; // Use the cached reference
                 if (directionToggle) {
                     this.state._boundHandleToggleChange = this.handleToggleChange.bind(this); // Bind and store
                     directionToggle.addEventListener('change', this.state._boundHandleToggleChange);
                     console.log(`[${this.id}] Direction toggle listener attached.`);
                 } else { console.warn(`[${this.id}] DirectionToggle not found for listeners.`);}


                 // Info button (Delegated listener within the container)
                 // Assumes showHelp does its own DOM manipulation and listener setup/teardown
                 translateTabContent.addEventListener('click', (e) => { // Listener on tab content area
                     const infoButton = e.target.closest('.info-button');
                     if (infoButton && infoButton.dataset.handler === 'showHelp') {
                         this.showHelp(); // Call the method
                     }
                 });
                console.log(`[${this.id}] Info button delegated listener attached.`);


                 // Copy output button (Delegated listener within the container)
                 translateTabContent.addEventListener('click', (e) => { // Listener on tab content area
                    const copyButton = e.target.closest('.copy-button');
                    if (copyButton && copyButton.dataset.handler === 'copyOutputToClipboard') {
                         this.copyOutputToClipboard(); // Call the method
                     }
                 });
                console.log(`[${this.id}] Copy output button delegated listener attached.`);


                 // Symbol category tabs (Delegated listener within symbol palette)
                 const symbolPalette = this.dom.symbolPalette; // Use cached reference
                 if(symbolPalette) {
                    symbolPalette.addEventListener('click', (e) => {
                         const categoryTab = e.target.closest(`.${this.id}-symbol-category`);
                         if (categoryTab && categoryTab.dataset.handler === 'switchSymbolCategory') {
                             const categoryId = categoryTab.getAttribute('data-category');
                            this.switchSymbolCategory(categoryId); // Call the method
                         }
                    });
                    console.log(`[${this.id}] Symbol category tab listener attached to palette.`);
                 }


                 // Symbol buttons (Delegated listener within symbol palette)
                 if(symbolPalette) { // Use the cached reference
                     symbolPalette.addEventListener('click', (e) => {
                         const symbolButton = e.target.closest(`.${this.id}-symbol-button`);
                         if (symbolButton && symbolButton.dataset.handler === 'insertSymbol') {
                            const symbol = symbolButton.getAttribute('data-symbol');
                            this.insertSymbol(e, symbol); // Call the method, pass original event
                         }
                     });
                    console.log(`[${this.id}] Symbol button listener attached to palette.`);
                 }
             }


            // --- Visual Builder Tab Listeners ---
            const visualBuilderTabContent = this.dom.content?.querySelector(`.${this.id}-builder-tab`);
            if (visualBuilderTabContent) {
                 const canvas = this.dom.visualBuilder?.canvas; // Use cached reference
                if (canvas) {
                     // Drag/Drop listeners for the canvas (Direct listeners on the canvas)
                     this.state._handleBuilderDragOverBound = (e) => { 
                        e.preventDefault(); 
                        canvas.style.backgroundColor = '#eaf5ff'; 
                        canvas.style.border = '1px dashed #4a76a8'; 
                     };
                     
                     this.state._handleBuilderDragLeaveBound = () => { 
                        canvas.style.backgroundColor = '#f9f9f9'; 
                        canvas.style.border = '1px solid #ddd'; 
                     };
                     
                     this.state._handleBuilderDropBound = (e) => {
                        e.preventDefault(); 
                        canvas.style.backgroundColor = '#f9f9f9'; 
                        canvas.style.border = '1px solid #ddd';
                        const data = e.dataTransfer.getData('text/plain');
                        if (data) { 
                            try { 
                                const componentData = JSON.parse(data); 
                                this.addBuilderNode(componentData); 
                            } catch (error) { 
                                console.error(`[${this.id}] Error adding component to builder:`, error); 
                            } 
                        }
                     };
                     
                     canvas.addEventListener('dragover', this.state._handleBuilderDragOverBound);
                     canvas.addEventListener('dragleave', this.state._handleBuilderDragLeaveBound);
                     canvas.addEventListener('drop', this.state._handleBuilderDropBound);
                     console.log(`[${this.id}] Builder canvas drag/drop listeners attached.`);


                    // Component Drag Start listeners (Delegated listener on palette container)
                     // Components themselves are created *inside* switchBuilderCategory.
                     // Need a delegation listener on the parent palette container.
                    const builderPaletteContainer = this.dom.visualBuilder?.components;
                    if (builderPaletteContainer) {
                        this.state._handleComponentDragStartBound = (e) => { // Bind and store
                             const target = e.target.closest(`.${this.id}-builder-component`);
                            if (target) {
                                // Ensure component data is available or reconstructible from element data
                                 const compData = {
                                     id: target.id,
                                     label: target.textContent, // Or get from title if text changes
                                     value: target.dataset.value,
                                     type: target.dataset.type
                                 };
                                 e.dataTransfer.setData('text/plain', JSON.stringify(compData));
                                 e.dataTransfer.effectAllowed = 'copy';
                                 console.log(`[${this.id}] Drag start: ${compData.value}`);
                             }
                         };
                        builderPaletteContainer.addEventListener('dragstart', this.state._handleComponentDragStartBound);
                         console.log(`[${this.id}] Builder component dragstart delegation attached.`);
                    } else { console.warn(`[${this.id}] Builder Palette Container not found for dragstart delegation.`);}


                    // Button handlers within the builder (Delegated listener on tab content area)
                    visualBuilderTabContent.addEventListener('click', (e) => {
                        const clearBtn = e.target.closest('button');
                        if (clearBtn) { // Ensure it's a button
                             const actionButtonsContainer = clearBtn.closest('.action-buttons');
                            if (actionButtonsContainer) { // Check if it's in the action buttons group
                                 if (clearBtn.textContent === 'Clear') this.clearVisualBuilder();
                                else if (clearBtn.textContent === 'Copy') this.copyBuilderOutput();
                                else if (clearBtn.textContent === 'Use in Translator') this.useBuilderOutput();
                            }
                        }
                    });
                     console.log(`[${this.id}] Builder action button delegated listener attached.`);
                }


                // Builder category tabs (Delegated listener on tab content area)
                visualBuilderTabContent.addEventListener('click', (e) => { // Listener on tab content area
                    const categoryTab = e.target.closest(`.${this.id}-builder-category`);
                    if (categoryTab && categoryTab.dataset.handler === 'switchBuilderCategory') {
                         const categoryId = categoryTab.getAttribute('data-category');
                        this.switchBuilderCategory(categoryId); // Call the method
                     }
                });
                console.log(`[${this.id}] Builder category tab delegated listener attached.`);
            }


             // --- Patterns Tab Listeners ---
            const patternsTabContent = this.dom.content?.querySelector(`.${this.id}-patterns-tab`);
            if (patternsTabContent) {
                // Search input (Direct listener)
                 const searchInput = this.dom.commonPatterns?.search; // Use cached reference
                 if (searchInput) {
                     this.state._handlePatternsInputBound = this.handlePatternSearch.bind(this); // Bind and store
                     searchInput.addEventListener('input', this.state._handlePatternsInputBound);
                    console.log(`[${this.id}] Patterns search input listener attached.`);
                 }


                // Patterns list item/button clicks (Delegated listener on the patterns list container)
                const patternsListContainer = this.dom.commonPatterns?.list; // Use cached reference
                 if (patternsListContainer) {
                     // Bind and store the single delegated handler
                    this.state._handlePatternsListClickBound = (e) => {
                        const patternItem = e.target.closest(`.${this.id}-pattern-item`);
                        if (patternItem) {
                            if (e.target.closest('button')) { // Clicked on a button inside the item ('Use')
                                const useButton = e.target.closest('button');
                                const patternCodeElement = patternItem.querySelector(`.${this.id}-pattern-code`);
                                if (useButton && patternCodeElement) {
                                    this.insertPattern(patternCodeElement.textContent); // Insert pattern
                                    this.switchTab('translate'); // Switch tab
                                    // Prevent event from propagating further (e.g., triggering item preview click)
                                    e.stopPropagation();
                                }
                            } else { // Clicked on the pattern item itself (not a button)
                                const patternCodeElement = patternItem.querySelector(`.${this.id}-pattern-code`);
                                if (patternCodeElement) {
                                    const patternString = patternCodeElement.textContent;
                                    // Find the corresponding pattern data by pattern string
                                     const patternData = this.state.commonPatterns.find(p => p.pattern === patternString); // Assumes commonPatterns array exists
                                     if(patternData) {
                                        this.previewPattern(patternData); // Show preview
                                     } else {
                                         console.warn(`[${this.id}] Pattern data not found for preview: ${patternString}`);
                                     }
                                }
                            }
                        }
                    };
                     patternsListContainer.addEventListener('click', this.state._handlePatternsListClickBound);
                     console.log(`[${this.id}] Patterns list delegated click listener attached.`);


                     // Listener for Pattern Category Expansion (Delegated on list container)
                     patternsListContainer.addEventListener('click', (e) => {
                         const header = e.target.closest(`.${this.id}-pattern-category-header`);
                        if (header) {
                             const categoryId = header.dataset.category; // Get category ID
                             const patternsListItems = header.nextElementSibling; // The div containing pattern items (ul/div)

                             if (patternsListItems) {
                                 const isExpanded = patternsListItems.style.display !== 'none';
                                patternsListItems.style.display = isExpanded ? 'none' : 'block';
                                // Optional: Update arrow icon or header style
                             }
                         }
                     });
                     console.log(`[${this.id}] Pattern category header click listener attached to list container.`);
                 }
             }


             // --- Global Listeners (Attached only when panel is OPEN) ---
             // Listener for hiding suggestions when clicking outside / Help dialog backdrop
             this.state._documentClickListenerBound = (e) => {
                 // Hide auto-complete suggestions if visible and click is outside input or suggestions list
                 const clickedInsideInput = this.dom.inputArea?.contains(e.target) ?? false; // Use cached refs
                 const clickedInsideSuggestions = this.dom.suggestionsContainer?.contains(e.target) ?? false; // Use cached refs
                 if (this.state._autoCompleteActive && !(clickedInsideInput || clickedInsideSuggestions)) {
                    this.hideSuggestions();
                 }

                 // Hide help dialog if visible and click is on the backdrop or close button (handled by showHelp internally) but not on dialog itself or info button
                 const clickedInsideHelp = this.dom.helpDialog?.contains(e.target) ?? false; // Use cached refs
                 const clickedOnInfoButton = (e.target.closest('.info-button') !== null && e.target.closest('.info-button').dataset.handler === 'showHelp'); // Check if click originated from *this panel's* info button

                if (this.dom.helpDialog && this.dom.helpDialog.style.display !== 'none' && !clickedInsideHelp && !clickedOnInfoButton) {
                    this.hideHelp(); // Call the method to hide and cleanup the help dialog
                }
             };
             // Attach this listener to the document
             document.addEventListener('click', this.state._documentClickListenerBound);
             console.log(`[${this.id}] Global document click listener attached (hiding suggestions/help).`);


             // Listener for symbol tooltips (using delegation on the document body)
             this.state._documentMouseOverListenerBound = (e) => {
                 const symbolButton = e.target.closest(`.${this.id}-symbol-button`); // Check if mouseover is on a symbol button
                 if (symbolButton && this.state._tooltipElement) { // Ensure button and tooltip element exist
                     const symbol = symbolButton.getAttribute('data-symbol');
                     const description = symbolButton.getAttribute('title'); // Get tooltip text from title

                     this.state._tooltipElement.textContent = `${symbol}: ${description}`;
                     this.state._tooltipElement.style.display = 'block'; // Show the tooltip

                     // Position tooltip near the button
                     const rect = symbolButton.getBoundingClientRect(); // Position of the button
                     const tooltipRect = this.state._tooltipElement.getBoundingClientRect(); // Size of the tooltip

                     // Position above the button, centered horizontally, with clamping to viewport edges
                     const tooltipTop = rect.top - tooltipRect.height - 5; // 5px padding above
                     const tooltipLeft = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

                     this.state._tooltipElement.style.top = `${Math.max(5, tooltipTop)}px`; // Clamp top to 5px minimum
                     this.state._tooltipElement.style.left = `${Math.max(5, Math.min(tooltipLeft, window.innerWidth - tooltipRect.width - 5))}px`; // Clamp left/right

                 }
             };
            // Attach this listener to the document
             document.addEventListener('mouseover', this.state._documentMouseOverListenerBound);
             console.log(`[${this.id}] Global document mouseover listener attached (symbol tooltips).`);

             this.state._documentMouseOutListenerBound = (e) => {
                 const symbolButton = e.target.closest(`.${this.id}-symbol-button`); // Check if mouseout originated from a symbol button
                // Use a small delay and check if the mouse has entered another symbol button or the tooltip itself.
                 if (symbolButton && this.state._tooltipElement) { // Ensure button and tooltip exist
                     setTimeout(() => {
                         const relatedTarget = e.relatedTarget; // The element the mouse entered
                         // Check if the new element is a symbol button from this panel or the tooltip element itself
                         const isHoveringRelatedSymbolButton = relatedTarget?.closest(`.${this.id}-symbol-button`) !== null;
                         const isHoveringTooltip = relatedTarget === this.state._tooltipElement || (this.state._tooltipElement?.contains(relatedTarget) ?? false);

                         // Hide the tooltip only if NOT hovering a related symbol button AND NOT hovering the tooltip
                          if (!isHoveringRelatedSymbolButton && !isHoveringTooltip) {
                             this.state._tooltipElement.style.display = 'none';
                         }
                     }, 10); // Short delay to prevent flicker during rapid movement over adjacent symbols
                 }
             };
            // Attach this listener to the document
             document.addEventListener('mouseout', this.state._documentMouseOutListenerBound);
             console.log(`[${this.id}] Global document mouseout listener attached (symbol tooltips).`);


             // Setup ResizeObserver (Attached only when panel is OPEN)
             // This is attached to the *panel's content* element, not the window, for precision.
             if (typeof ResizeObserver !== 'undefined' && this.dom.content) { // Check if ResizeObserver exists and we have the content element
                 // Bind the checkPanelSize function for correct 'this' context
                 this._boundCheckPanelSize = this.checkPanelSize.bind(this);
                 this.state._resizeObserver = new ResizeObserver(this._boundCheckPanelSize); // Observer will call checkPanelSize

                 // Start observing the panel's content element
                 this.state._resizeObserver.observe(this.dom.content);
                 console.log(`[${this.id}] ResizeObserver attached to panel content element.`);
             } else {
                 console.warn(`[${this.id}] ResizeObserver not available. Layout may not adapt perfectly to panel resize.`);
             }


            console.log(`[${this.id}] All panel-specific interactive event listeners attached.`);
        },

        /**
         * Handles the logic for removing *all* event listeners attached in `addEventListeners`.
         * This function is called *only* from the `onPanelClose` lifecycle method.
         */
        removeEventListeners: function() {
            console.log(`[${this.id}] Removing event listeners (panel closed)...`);

             // --- Remove Translate Tab Listeners ---
             // Remove Input area listeners (Use the stored bound references for removal)
             const inputArea = this.dom.inputArea; // Use cached reference
             if (inputArea) {
                 if (this.state._handleInputChangeBound) 
                    inputArea.removeEventListener('input', this.state._handleInputChangeBound);
                 if (this.state._handleInputKeydownBound) 
                    inputArea.removeEventListener('keydown', this.state._handleInputKeydownBound);
                 if (this.state._handleTranslateKeypressBound) 
                    inputArea.removeEventListener('keypress', this.state._handleTranslateKeypressBound);
                 if (this.state._handleCaretClickBound) 
                    inputArea.removeEventListener('click', this.state._handleCaretClickBound);
                 if (this.state._handleCaretKeyupBound) 
                    inputArea.removeEventListener('keyup', this.state._handleCaretKeyupBound);
                    
                console.log(`[${this.id}] Translate input area listeners removed.`);
                 // Nullify bound references
                 this.state._handleInputChangeBound = null; 
                 this.state._handleInputKeydownBound = null; 
                 this.state._handleTranslateKeypressBound = null; 
                 this.state._handleCaretClickBound = null; 
                 this.state._handleCaretKeyupBound = null;
             }

            // Remove Translate button listener (Use the stored bound reference)
             const translateButton = this.dom.translateButton; // Use cached reference
             if (translateButton && this.state._boundPerformTranslation) {
                 translateButton.removeEventListener('click', this.state._boundPerformTranslation);
                console.log(`[${this.id}] Translate button listener removed.`);
                 this.state._boundPerformTranslation = null; // Nullify bound reference
             }

            // Remove Direction Toggle listener (Use the stored bound reference)
             const directionToggle = this.dom.directionToggle; // Use cached reference
             if (directionToggle && this.state._boundHandleToggleChange) {
                 directionToggle.removeEventListener('change', this.state._boundHandleToggleChange);
                console.log(`[${this.id}] Direction toggle listener removed.`);
                 this.state._boundHandleToggleChange = null; // Nullify bound reference
             }

             // Remove Symbol category tabs delegated listener (from symbol palette parent)
             const symbolPalette = this.dom.symbolPalette; // Use cached reference
             if (symbolPalette) {
                // Event listener was attached to the palette container
                 symbolPalette.removeEventListener('click', (e) => { /* Logic was here */ }); // Need original reference!
                 // Better: Store the function references in state and remove properly
                  if(this.state._symbolCategoryClickListenerBound) {
                     symbolPalette.removeEventListener('click', this.state._symbolCategoryClickListenerBound);
                     this.state._symbolCategoryClickListenerBound = null;
                     console.log(`[${this.id}] Symbol category click listener properly removed from palette.`);
                  }
             }


             // Remove Symbol buttons delegated listener (from symbol palette parent)
             if (symbolPalette) { // Use cached reference
                 // Event listener was attached to the palette container
                 symbolPalette.removeEventListener('click', (e) => { /* Logic was here */ }); // Need original reference!
                 // Better: Store the function references in state and remove properly
                  if(this.state._symbolButtonClickListenerBound) {
                     symbolPalette.removeEventListener('click', this.state._symbolButtonClickListenerBound);
                     this.state._symbolButtonClickListenerBound = null;
                     console.log(`[${this.id}] Symbol button click listener properly removed from palette.`);
                  }
             }


            // --- Remove Visual Builder Tab Listeners ---
            const visualBuilderTabContent = this.dom.content?.querySelector(`.${this.id}-builder-tab`); // Get parent element
            if (visualBuilderTabContent) {
                 const canvas = this.dom.visualBuilder?.canvas; // Use cached reference
                if (canvas) {
                     // Remove Drag/Drop listeners from the canvas (Use stored bound references)
                    if(this.state._handleBuilderDragOverBound) 
                        canvas.removeEventListener('dragover', this.state._handleBuilderDragOverBound);
                    if(this.state._handleBuilderDragLeaveBound) 
                        canvas.removeEventListener('dragleave', this.state._handleBuilderDragLeaveBound);
                    if(this.state._handleBuilderDropBound) 
                        canvas.removeEventListener('drop', this.state._handleBuilderDropBound);
                    console.log(`[${this.id}] Builder canvas drag/drop listeners removed.`);
                    // Nullify bound references
                     this.state._handleBuilderDragOverBound = null; 
                     this.state._handleBuilderDragLeaveBound = null; 
                     this.state._handleBuilderDropBound = null;
                 }


                // Remove Component Drag Start listeners (from palette container)
                 const builderPaletteContainer = this.dom.visualBuilder?.components; // Get parent
                if (builderPaletteContainer && this.state._handleComponentDragStartBound) {
                     builderPaletteContainer.removeEventListener('dragstart', this.state._handleComponentDragStartBound);
                    console.log(`[${this.id}] Builder component dragstart delegation removed.`);
                     this.state._handleComponentDragStartBound = null;
                }


                // Remove Button handlers within the builder (Delegated from tab content)
                 if(this.state._builderActionButtonClickListenerBound) {
                     visualBuilderTabContent.removeEventListener('click', this.state._builderActionButtonClickListenerBound);
                     this.state._builderActionButtonClickListenerBound = null;
                     console.log(`[${this.id}] Builder action button delegated listener properly removed.`);
                 }


                // Remove Builder category tabs delegated listener (from tab content parent)
                  if(this.state._builderCategoryClickListenerBound) {
                     visualBuilderTabContent.removeEventListener('click', this.state._builderCategoryClickListenerBound);
                     this.state._builderCategoryClickListenerBound = null;
                     console.log(`[${this.id}] Builder category tab delegated listener properly removed.`);
                  }
            }


             // --- Remove Patterns Tab Listeners ---
             const patternsTabContent = this.dom.content?.querySelector(`.${this.id}-patterns-tab`); // Get parent element
            if (patternsTabContent) {
                 // Remove Search input listener (Use stored bound reference)
                 const searchInput = this.dom.commonPatterns?.search; // Use cached reference
                 if (searchInput && this.state._handlePatternsInputBound) {
                     searchInput.removeEventListener('input', this.state._handlePatternsInputBound);
                    console.log(`[${this.id}] Patterns search input listener removed.`);
                     this.state._handlePatternsInputBound = null;
                 }

                // Remove Patterns list item/button click delegated listener (from the patterns list container parent)
                 const patternsListContainer = this.dom.commonPatterns?.list; // Use cached reference
                 if (patternsListContainer) {
                     // Check if the bound function was stored and remove it
                     if(this.state._handlePatternsListClickBound) {
                        patternsListContainer.removeEventListener('click', this.state._handlePatternsListClickBound);
                        this.state._handlePatternsListClickBound = null;
                        console.log(`[${this.id}] Patterns list delegated click listener properly removed.`);
                     }
                 }


                // Remove Pattern Category Expansion delegated listener (from patterns list container parent)
                 if(patternsListContainer) { // Use cached reference
                     // Check if the bound function was stored and remove it
                    if(this.state._patternCategoryClickListenerBound) {
                         patternsListContainer.removeEventListener('click', this.state._patternCategoryClickListenerBound);
                         this.state._patternCategoryClickListenerBound = null;
                         console.log(`[${this.id}] Pattern category delegated click listener properly removed.`);
                    }
                 }
             }


             // --- Remove Global Listeners (Attached only when panel is OPEN) ---
             // Remove Listener for hiding suggestions when clicking outside / Help dialog backdrop
             if (this.state._documentClickListenerBound) {
                 document.removeEventListener('click', this.state._documentClickListenerBound);
                 this.state._documentClickListenerBound = null;
                 console.log(`[${this.id}] Global document click listener removed.`);
             }

             // Remove Listener for symbol tooltips (delegation from document body)
             if(this.state._documentMouseOverListenerBound) {
                 document.removeEventListener('mouseover', this.state._documentMouseOverListenerBound);
                 this.state._documentMouseOverListenerBound = null;
                 console.log(`[${this.id}] Global document mouseover listener removed.`);
             }
             if(this.state._documentMouseOutListenerBound) {
                document.removeEventListener('mouseout', this.state._documentMouseOutListenerBound);
                 this.state._documentMouseOutListenerBound = null;
                 console.log(`[${this.id}] Global document mouseout listener removed.`);
             }


             // Disconnect ResizeObserver
             if (this.state._resizeObserver) {
                 this.state._resizeObserver.disconnect();
                 this.state._resizeObserver = null;
                 // The checkPanelSize method needs to be bound before passing to ResizeObserver
                 if(this._boundCheckPanelSize) this._boundCheckPanelSize = null; // Clear the bound ref
                 console.log(`[${this.id}] ResizeObserver disconnected.`);
             }


             // Ensure auto-complete timeout is cleared (safety)
             if (this.state._autoCompleteTimeout) {
                 clearTimeout(this.state._autoCompleteTimeout);
                 this.state._autoCompleteTimeout = null;
                 console.log(`[${this.id}] Auto-complete timeout cleared.`);
             }

             // Hide any active tooltip on close
            if(this.state._tooltipElement) { // Check the element exists
                 this.state._tooltipElement.style.display = 'none';
             }
            // Hide any active help dialog on close
             this.hideHelp(); // Assuming hideHelp cleans up its DOM and listeners (buttons, escape)


            console.log(`[${this.id}] All panel-specific interactive event listeners removed.`);
         },

        /**
         * Switch symbol category and update the symbol palette
         */
        switchSymbolCategory: function(categoryId) {
            if (this.state.currentSymbolCategory === categoryId) return;
            
            this.state.currentSymbolCategory = categoryId;
            
            // Update category buttons
            const categoryButtons = document.querySelectorAll(`.${this.id}-symbol-category`);
            categoryButtons.forEach(button => {
                if (button.getAttribute('data-category') === categoryId) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
            
            // Update symbol buttons
            const symbolButtonsContainer = this.dom.symbolPalette?.querySelector('.symbol-buttons');
            if (symbolButtonsContainer && this.state.symbolGroups[categoryId]) {
                symbolButtonsContainer.innerHTML = '';
                
                this.state.symbolGroups[categoryId].forEach(item => {
                    const button = document.createElement('button');
                    button.className = `${this.id}-symbol-button`;
                    button.setAttribute('data-symbol', item.symbol);
                    button.setAttribute('title', item.description);
                    button.setAttribute('data-handler', 'insertSymbol');
                    button.textContent = item.symbol;
                    symbolButtonsContainer.appendChild(button);
                });
            }
        },

        /**
         * Switch builder category and update components
         */
        switchBuilderCategory: function(categoryId) {
            // Update category buttons
            const categoryButtons = document.querySelectorAll(`.${this.id}-builder-category`);
            categoryButtons.forEach(button => {
                if (button.getAttribute('data-category') === categoryId) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
            
            // Update component palette
            const paletteContainer = this.dom.visualBuilder?.components;
            if (!paletteContainer) return;
            
            paletteContainer.innerHTML = '';
            
            // Different components based on category
            let components = [];
            
            switch (categoryId) {
                case 'basic':
                    components = [
                        { id: 'user-container', label: 'User Container', value: '[]', type: 'container' },
                        { id: 'ai-container', label: 'AI Container', value: '{}', type: 'container' },
                        { id: 'conceptual-frame', label: 'Conceptual Frame', value: '<>', type: 'container' },
                        { id: 'grouping', label: 'Grouping', value: '()', type: 'container' }
                    ];
                    break;
                case 'flow':
                    components = [
                        { id: 'directional-flow', label: 'Directional Flow', value: '⇒', type: 'flow' },
                        { id: 'mutual-interaction', label: 'Mutual Interaction', value: '≺≻', type: 'flow' },
                        { id: 'parallel-flow', label: 'Parallel Flow', value: '∥', type: 'flow' },
                        { id: 'association-link', label: 'Association Link', value: '~', type: 'flow' },
                        { id: 'location-relation', label: 'Location Relation', value: '@', type: 'flow' }
                    ];
                    break;
                case 'logic':
                    components = [
                        { id: 'if-condition', label: 'IF Condition', value: 'IF{}', type: 'logic' },
                        { id: 'then-path', label: 'THEN Path', value: 'THEN⇒', type: 'logic' },
                        { id: 'else-path', label: 'ELSE Path', value: 'ELSE⇒', type: 'logic' },
                        { id: 'loop-until', label: 'LOOP UNTIL', value: 'LOOP UNTIL', type: 'logic' },
                        { id: 'on-exit', label: 'ON_EXIT', value: 'ON_EXIT:', type: 'logic' },
                        { id: 'mutate-state', label: 'Mutate State', value: 'MutateState :', type: 'logic' }
                    ];
                    break;
                case 'states':
                    components = [
                        { id: 'success', label: 'Success', value: '✅', type: 'state' },
                        { id: 'failure', label: 'Failure', value: '❌', type: 'state' },
                        { id: 'scratchpad', label: 'Scratchpad', value: '📝', type: 'state' },
                        { id: 'archive', label: 'Archive', value: '📦', type: 'state' },
                        { id: 'presentation', label: 'Presentation', value: '🖥️', type: 'state' },
                        { id: 'discard', label: 'Discard', value: '🗑️', type: 'state' }
                    ];
                    break;
            }
            
            // Create component elements
            components.forEach(component => {
                const comp = document.createElement('div');
                comp.className = `${this.id}-builder-component`;
                comp.id = component.id;
                comp.setAttribute('draggable', 'true');
                comp.setAttribute('data-value', component.value);
                comp.setAttribute('data-type', component.type);
                comp.textContent = component.label;
                paletteContainer.appendChild(comp);
            });
        },

        /**
         * Handle toggle change for translation direction
         */
        handleToggleChange: function(e) {
            const isChecked = e.target.checked;
            this.state.translateSS_to_NL = !isChecked; // Toggle is inverse of SS->NL
            this.updateLabelsAndStyling();
        },

        /**
         * Updates UI labels and styling based on current translation direction
         */
        updateLabelsAndStyling: function() {
            if (!this.dom.inputLabel || !this.dom.outputLabel || !this.dom.directionLabelSpan ||
                !this.dom.inputArea || !this.dom.outputArea || !this.dom.symbolPalette) {
                console.error(`[${this.id}] Missing required DOM elements to update labels and styling.`);
                // This indicates a significant failure in renderUI - return early if necessary
                return;
            }

            const isSStoNL = this.state.translateSS_to_NL;

            // Set labels for input and output areas
            this.dom.inputLabel.textContent = isSStoNL ? 'Silent-Structure Pattern:' : 'Natural Language Text:';
            this.dom.outputLabel.textContent = isSStoNL ? 'Natural Language Interpretation:' : 'Silent-Structure Pattern:';

            // Set placeholder texts for textareas
            this.dom.inputArea.placeholder = isSStoNL
                ? 'Enter Silent-Structure pattern here (e.g., < [] ⇒ {} >)...'
                : 'Enter text to translate into Silent-Structure...';
            this.dom.outputArea.placeholder = isSStoNL
                ? 'SS interpretation appears here...'
                : 'Silent-Structure pattern suggestion appears here...';

            // Update the text displayed next to the translation toggle switch
            // Uses innerHTML to support the strong tag
            this.dom.directionLabelSpan.innerHTML = isSStoNL
                ? 'Translate <strong>SS Pattern</strong> → Text'
                : 'Translate Text → <strong>SS Pattern</strong>';


            // Configure readOnly property for the input/output textareas
            this.dom.inputArea.readOnly = false; // Input is always editable
            this.dom.outputArea.readOnly = true; // Output is always read-only


            // Adjust font families based on translation direction
            // Monospace for pattern, standard font for natural language
            this.dom.inputArea.style.fontFamily = isSStoNL ? 'monospace' : 'var(--font-family, sans-serif)';
            this.dom.outputArea.style.fontFamily = isSStoNL ? 'var(--font-family, sans-serif)' : 'monospace';

            // Control visibility of the symbol palette based on direction
            // Symbol palette is useful for building SS patterns (SS -> NL direction)
            this.dom.symbolPalette.style.display = isSStoNL ? 'flex' : 'none';


            // Ensure the visual state of the input error (border) is cleared
            this.dom.inputArea.classList.remove('input-error');

            // Find and remove the specific error message element placed below the input wrapper if it was previously shown
            const existingErrorMsg = this.dom.inputArea.parentNode.querySelector(`.${this.id}-error-message`);
            if (existingErrorMsg) {
                existingErrorMsg.remove();
            }

            // Clear any currently displayed auto-complete suggestions if present
            this.hideSuggestions();

            console.log(`[${this.id}] UI labels and styling updated for current direction.`);
        },

        /**
         * Perform the translation based on current direction
         */
        performTranslation: function() {
            const inputText = this.dom.inputArea?.value.trim();
            if (!inputText) {
                // Show error styling
                this.dom.inputArea?.classList.add('input-error');
                
                // Add error message
                const errorMsg = document.createElement('div');
                errorMsg.className = `${this.id}-error-message`;
                errorMsg.textContent = 'Please enter some text to translate.';
                this.dom.inputArea?.parentNode.appendChild(errorMsg);
                
                // Hide error after delay
                setTimeout(() => {
                    this.dom.inputArea?.classList.remove('input-error');
                    errorMsg.remove();
                }, 3000);
                
                return;
            }
            
            // Clear any previous error state
            this.dom.inputArea?.classList.remove('input-error');
            const existingErrorMsg = this.dom.inputArea?.parentNode.querySelector(`.${this.id}-error-message`);
            if (existingErrorMsg) existingErrorMsg.remove();
            
            // Perform translation based on direction
            let translatedText = '';
            if (this.state.translateSS_to_NL) {
                // SS -> NL translation
                translatedText = this.translatePatternToText(inputText);
            } else {
                // NL -> SS translation
                translatedText = this.translateTextToPattern(inputText);
                
                // Show "Did You Mean" suggestions after NL->SS translation
                this.showDidYouMeanSuggestions(inputText, translatedText);
            }
            
            // Update output area
            if (this.dom.outputArea) {
                this.dom.outputArea.value = translatedText;
            }
        },

        /**
         * Show "Did You Mean" suggestions after NL->SS translation
         */
        showDidYouMeanSuggestions: function(inputText, translatedOutput) {
            // Implementation omitted for brevity
        },

        /**
         * Handle input changes for auto-complete
         */
        handleInputChange: function(e) {
            // Implementation omitted for brevity
        },

        /**
         * Handle input keydown for auto-complete navigation
         */
        handleInputKeydown: function(e) {
            // Implementation omitted for brevity
        },

        /**
         * Show auto-complete suggestions
         */
        showAutoCompleteSuggestions: function(inputText, position) {
            // Implementation omitted for brevity
        },

        /**
         * Hide auto-complete suggestions
         */
        hideSuggestions: function() {
            // Implementation omitted for brevity
        },

        /**
         * Navigate suggestions using keyboard
         */
        navigateSuggestions: function(direction) {
            // Implementation omitted for brevity
        },

        /**
         * Apply selected suggestion
         */
        applySuggestion: function(suggestion) {
            // Implementation omitted for brevity
        },

        /**
         * Insert a pattern into the input area
         */
        insertPattern: function(pattern) {
            if (!this.dom.inputArea) return;
            
            const inputArea = this.dom.inputArea;
            const currentPos = inputArea.selectionStart;
            const currentValue = inputArea.value;
            
            // Insert pattern at current cursor position
            const newValue = currentValue.substring(0, currentPos) + pattern + currentValue.substring(inputArea.selectionEnd);
            inputArea.value = newValue;
            
            // Set cursor position after inserted pattern
            const newPosition = currentPos + pattern.length;
            inputArea.selectionStart = newPosition;
            inputArea.selectionEnd = newPosition;
            
            // Focus the input area
            inputArea.focus();
            
            // Switch to translate tab if not already there
            this.switchTab('translate');
            
            // Switch to SS->NL mode if not already in that mode
            if (!this.state.translateSS_to_NL) {
                this.state.translateSS_to_NL = true;
                if (this.dom.directionToggle) {
                    this.dom.directionToggle.checked = false;
                }
                this.updateLabelsAndStyling();
            }
        },

        /**
         * Insert a symbol at cursor position
         */
        insertSymbol: function(e, symbol) {
            if (!this.dom.inputArea || !symbol) return;
            
            const inputArea = this.dom.inputArea;
            const currentPos = this.state._lastCaretPosition || inputArea.selectionStart;
            const currentValue = inputArea.value;
            
            // Insert symbol at current cursor position
            const newValue = currentValue.substring(0, currentPos) + symbol + currentValue.substring(inputArea.selectionEnd);
            inputArea.value = newValue;
            
            // Set cursor position after inserted symbol
            const newPosition = currentPos + symbol.length;
            inputArea.selectionStart = newPosition;
            inputArea.selectionEnd = newPosition;
            this.state._lastCaretPosition = newPosition;
            
            // Focus the input area
            inputArea.focus();
        },

        /**
         * Copy output to clipboard
         */
        copyOutputToClipboard: function() {
            // Ensure outputArea DOM reference is valid
            if (!this.dom.outputArea) {
                 console.error(`[${this.id}] Output textarea element not found for copy action.`);
                 // Show a more user-friendly message? Maybe indicate UI issue.
                return;
            }

            const outputText = this.dom.outputArea.value; // Get the current value of the output textarea

            // If output is empty or just whitespace, don't try to copy
            if (!outputText.trim()) {
                Framework.showToast('Nothing to copy');
                return;
            }

            // Use the modern Clipboard API for copying text
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(outputText)
                    .then(() => {
                        // Success callback - show feedback to the user
                        Framework.showToast('Copied to clipboard');
                        console.log(`[${this.id}] Output text successfully copied to clipboard.`);
                    })
                    .catch(err => {
                        // Error callback - log error and show fallback message
                        console.error(`[${this.id}] Failed to copy URL using Clipboard API:`, err);
                        Framework.showToast('Failed to copy to clipboard');

                        // Fallback to the deprecated `document.execCommand` method for older browsers
                        this.fallbackCopyToClipboard(outputText);
                    });
            } else {
                // Browser does not support the modern Clipboard API - fall back directly
                console.warn(`[${this.id}] Clipboard API not available. Using fallback for clipboard copy.`);
                this.fallbackCopyToClipboard(outputText);
            }
        },

        /**
         * Fallback method to copy text to clipboard using a temporary textarea element.
         * This is less reliable than the Clipboard API and may not work in all modern environments.
         */
        fallbackCopyToClipboard: function(text) {
             // Ensure input text is provided
             if (typeof text !== 'string' || text.length === 0) {
                 console.warn(`[${this.id}] Fallback copy called with invalid text.`);
                 return;
             }

            // Create a temporary textarea element
            const textArea = document.createElement('textarea');
            textArea.value = text; // Set the text to be copied

            // Position the textarea outside the visible viewport to avoid disrupting the UI
            textArea.style.position = 'fixed'; // Fixed position relative to the viewport
            textArea.style.left = '-999999px'; // Move off-screen to the left
            textArea.style.top = '-999999px'; // Move off-screen to the top

            // Append the textarea to the document body
            document.body.appendChild(textArea);

            // Select the text inside the textarea
            textArea.focus(); // Focus the element
            textArea.select(); // Select the text (standard API call)

            let success = false;
            try {
                // Execute the deprecated 'copy' command
                success = document.execCommand('copy');
                if (success) {
                     console.log(`[${this.id}] Output text successfully copied using execCommand fallback.`);
                     Framework.showToast('Copied to clipboard');
                 } else {
                     console.warn(`[${this.id}] document.execCommand('copy') failed.`);
                     Framework.showToast('Failed to copy text. Please copy it manually');
                 }
            } catch (err) {
                 // Catch potential errors during the execCommand call
                 console.error(`[${this.id}] Fallback clipboard copy failed with error:`, err);
                 Framework.showToast('Failed to copy text. Please copy it manually');
            } finally {
                // Always remove the temporary textarea from the DOM
                if (textArea.parentNode === document.body) {
                     document.body.removeChild(textArea);
                }
            }
        },

        /**
         * Shows help modal with instructions
         */
        showHelp: function() {
            // Only create/show dialog if it doesn't exist or isn't currently visible
            if (this.dom.helpDialog?.style.display === 'block') {
                console.log(`[${this.id}] Help dialog already visible.`);
                return;
            }

             console.log(`[${this.id}] Showing help dialog.`);

             // Ensure overlay and dialog elements exist (create them the first time showHelp is called)
             if (!this.dom.helpOverlay) {
                 this.dom.helpOverlay = document.createElement('div');
                 this.dom.helpOverlay.className = `${this.id}-help-overlay`;
                 // Listener attached in addEventListeners: global document click hides backdrop
                 document.body.appendChild(this.dom.helpOverlay);
                 console.log(`[${this.id}] Help overlay DOM created.`);
             }
             if (!this.dom.helpDialog) {
                 this.dom.helpDialog = document.createElement('div');
                 this.dom.helpDialog.className = `${this.id}-help`;
                 this.dom.helpDialog.innerHTML = `
                     <h3>Silent-Structure Translator Help</h3>
                     <button class="${this.id}-help-close">×</button>

                     <div style="margin-bottom: 15px;">
                         <h4>What is Silent-Structure?</h4>
                         <p>Silent-Structure (SS) is a symbolic notation used to represent and model interaction patterns, processes, and states in AI systems. It uses a combination of brackets, symbols, and operators to describe concepts and relationships.</p>
                     </div>

                     <div style="margin-bottom: 15px;">
                         <h4>Using the Translator</h4>
                         <p>This panel has three main tabs:</p>
                         <ul>
                             <li><strong>Translate:</strong> Translate between SS patterns and natural language</li>
                             <li><strong>Visual Builder:</strong> Create SS patterns using drag-and-drop</li>
                             <li><strong>Patterns:</strong> Browse common SS patterns and examples</li>
                         </ul>
                     </div>

                     <div style="margin-bottom: 15px;">
                         <h4>Translation Tips</h4>
                         <ul>
                             <li>Use the toggle to switch translation direction</li>
                             <li>When translating to SS, click on suggested patterns</li>
                             <li>When writing SS, use the symbol palette for quick insertion</li>
                             <li>The translator supports auto-complete for common SS structures</li>
                             <li>Press Ctrl+Enter to translate quickly</li>
                             <li>Click the clipboard icon to copy the output</li>
                         </ul>
                     </div>

                     <div style="margin-bottom: 15px;">
                         <h4>Common SS Symbols</h4>
                         <div style="display: grid; grid-template-columns: auto 1fr; gap: 5px; font-size: 0.9em;">
                             <div style="font-family: monospace;">[]</div>
                             <div>User Container</div>

                             <div style="font-family: monospace;">{}</div>
                             <div>AI Container</div>

                             <div style="font-family: monospace;">&lt;&gt;</div>
                             <div>Conceptual Frame</div>

                             <div style="font-family: monospace;">⇒</div>
                             <div>Directional Flow</div>

                             <div style="font-family: monospace;">≺≻</div>
                             <div>Mutual Interaction</div>

                             <div style="font-family: monospace;">∥</div>
                             <div>Parallel Flow</div>
                         </div>
                     </div>

                     <div style="margin-bottom: 15px;">
                         <h4>Keyboard Shortcuts</h4>
                         <div style="display: grid; grid-template-columns: auto 1fr; gap: 5px; font-size: 0.9em;">
                             <div><kbd>Ctrl</kbd>+<kbd>Enter</kbd></div>
                             <div>Translate input</div>

                             <div><kbd>Tab</kbd></div>
                             <div>Complete suggestion when auto-complete is active</div>

                             <div><kbd>↑</kbd>/<kbd>↓</kbd></div>
                             <div>Navigate through auto-complete suggestions</div>

                             <div><kbd>Esc</kbd></div>
                             <div>Close auto-complete suggestions</div>
                         </div>
                     </div>
                 `;
                 // Add click handler for the close button within the dialog
                 const closeButton = this.dom.helpDialog.querySelector(`.${this.id}-help-close`);
                if (closeButton) closeButton.onclick = () => this.hideHelp();
                 // Listener for Escape key attached below
                 document.body.appendChild(this.dom.helpDialog);
                 console.log(`[${this.id}] Help dialog DOM created.`);
             }

             // Set display to block for overlay and dialog to make them visible
            this.dom.helpOverlay.style.display = 'flex'; // Use flex to keep content centered
             this.dom.helpDialog.style.display = 'block'; // Dialog becomes block element

            // Prevent clicks within the dialog from bubbling to the document click handler
            // This ensures clicking inside the dialog doesn't hide it if the handler wasn't sophisticated
             this.dom.helpDialog.onclick = (e) => e.stopPropagation();

            // Handle Escape key press for accessibility (close dialog)
             this._handleEscapeKeyBound = (e) => {
                 if (e.key === 'Escape') {
                     this.hideHelp(); // Call the hide method
                 }
             };
            // Add listener to the document only when the dialog is open
            document.addEventListener('keydown', this._handleEscapeKeyBound);

            console.log(`[${this.id}] Help dialog and overlay are now visible.`);
        },

         /**
          * Hides the help modal and cleans up related DOM elements and listeners.
          */
         hideHelp: function() {
             // Check if dialog exists and is visible before trying to hide
             if (!this.dom.helpDialog || this.dom.helpDialog.style.display === 'none') {
                 return;
             }
             console.log(`[${this.id}] Hiding help dialog.`);

             // Hide the dialog and overlay
             this.dom.helpDialog.style.display = 'none';
             if (this.dom.helpOverlay) this.dom.helpOverlay.style.display = 'none';

             // Remove the document keydown listener (bound function)
             if (this._handleEscapeKeyBound) {
                 document.removeEventListener('keydown', this._handleEscapeKeyBound);
                 this._handleEscapeKeyBound = null; // Nullify reference
             }

            // Remove the click prevention handler added to the dialog body
            if(this.dom.helpDialog) this.dom.helpDialog.onclick = null; // Reset handler

             console.log(`[${this.id}] Help dialog hidden and cleanup complete.`);
         },

        /**
         * Add a node to the visual builder canvas
         */
        addBuilderNode: function(componentData) {
            // Implementation omitted for brevity
        },

        /**
         * Clear the visual builder canvas
         */
        clearVisualBuilder: function() {
            // Implementation omitted for brevity
        },

        /**
         * Copy the builder output to clipboard
         */
        copyBuilderOutput: function() {
            // Implementation omitted for brevity
        },

        /**
         * Use the builder output in the translator
         */
        useBuilderOutput: function() {
            // Implementation omitted for brevity
        },

        /**
         * Preview a pattern in the patterns tab
         */
        previewPattern: function(patternData) {
            // Implementation omitted for brevity
        },

        /**
         * Handle pattern search in the patterns tab
         */
        handlePatternSearch: function(e) {
            // Implementation omitted for brevity
        },

        /**
         * Check panel size and adjust layout
         */
        checkPanelSize: function() {
            // Implementation omitted for brevity
        },

     /**
         * Add component-specific styles to the document head
         */
        addStyles: function() {
            const styleId = `${this.id}-styles`;
            if (document.getElementById(styleId)) return;
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Main Container */
                .${this.id}-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                    font-size: 14px;
                    background-color: var(--color-background, #ffffff);
                }
                
                /* Tab Navigation */
                .${this.id}-tabs {
                    display: flex;
                    background-color: var(--color-background-light, #f8f9fa);
                    border-bottom: 1px solid var(--color-border, #dee2e6);
                }
                
                .${this.id}-tab-button {
                    padding: 8px 12px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .${this.id}-tab-button:hover {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                .${this.id}-tab-button.active {
                    background-color: var(--color-background, #ffffff);
                    border-bottom: 2px solid var(--color-primary, #007bff);
                    font-weight: bold;
                }
                
                .tab-icon {
                    font-size: 16px;
                }
                
                /* Tab Content */
                .${this.id}-tab-content {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                }
                
                .${this.id}-tab-pane {
                    height: 100%;
                    overflow-y: auto;
                    padding: 12px;
                }
                
                /* Direction toggle */
                .direction-toggle-container {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }
                
                .direction-label {
                    font-size: 14px;
                }
                
                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 20px;
                }
                
                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    border-radius: 10px;
                    transition: 0.3s;
                }
                
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 16px;
                    width: 16px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    border-radius: 50%;
                    transition: 0.3s;
                }
                
                input:checked + .slider {
                    background-color: var(--color-primary, #007bff);
                }
                
                input:checked + .slider:before {
                    transform: translateX(20px);
                }
                
                .info-button {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0 5px;
                }
                
                /* Input/Output Areas */
                .input-container, .output-container {
                    margin-bottom: 12px;
                }
                
                .input-label, .output-label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                
                .output-label-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .input-area, .output-area {
                    width: 100%;
                    padding: 8px;
                    font-size: 14px;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    resize: vertical;
                }
                
                .input-area:focus, .output-area:focus {
                    outline: none;
                    border-color: var(--color-primary, #007bff);
                    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
                }
                
                .input-error {
                    border-color: #dc3545 !important;
                }
                
                .${this.id}-error-message {
                    color: #dc3545;
                    font-size: 12px;
                    margin-top: 5px;
                }
                
                /* Symbol Palette */
                .symbol-palette {
                    margin-top: 10px;
                    margin-bottom: 10px;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                
                .symbol-categories {
                    display: flex;
                    border-bottom: 1px solid var(--color-border, #dee2e6);
                    background-color: var(--color-background-light, #f8f9fa);
                    overflow-x: auto;
                }
                
                .${this.id}-symbol-category {
                    padding: 6px 10px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .${this.id}-symbol-category:hover {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                .${this.id}-symbol-category.active {
                    background-color: var(--color-background, #ffffff);
                    border-bottom: 2px solid var(--color-primary, #007bff);
                    font-weight: bold;
                }
                
                .symbol-buttons {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
                    gap: 5px;
                    padding: 8px;
                    background-color: var(--color-background, #ffffff);
                    max-height: 150px;
                    overflow-y: auto;
                }
                
                .${this.id}-symbol-button {
                    padding: 5px;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    background-color: var(--color-background, #ffffff);
                    cursor: pointer;
                    font-size: 16px;
                    text-align: center;
                    transition: background-color 0.2s;
                }
                
                .${this.id}-symbol-button:hover {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                /* Translate Button */
                .translate-button-container {
                    text-align: center;
                    margin-bottom: 12px;
                }
                
                .translate-button {
                    padding: 8px 20px;
                    background-color: var(--color-primary, #007bff);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.2s;
                }
                
                .translate-button:hover {
                    background-color: var(--color-primary-dark, #0056b3);
                }
                
                /* Copy Button */
                .copy-button {
                    background: none;
                    border: none;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 0 5px;
                }
                
                /* Suggestions */
                .suggestion-area {
                    margin-top: 10px;
                }
                
                .suggestions-container {
                    background-color: var(--color-background, #ffffff);
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    max-height: 150px;
                    overflow-y: auto;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                }
                
                .suggestion-item {
                    padding: 6px 10px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .suggestion-item:hover, .suggestion-item.selected {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                /* Builder Tab */
                .builder-header {
                    margin-bottom: 15px;
                }
                
                .builder-title {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                }
                
                .builder-content {
                    display: flex;
                    flex-direction: column;
                    height: calc(100% - 40px);
                }
                
                .builder-categories {
                    display: flex;
                    border-bottom: 1px solid var(--color-border, #dee2e6);
                    margin-bottom: 10px;
                    overflow-x: auto;
                }
                
                .${this.id}-builder-category {
                    padding: 6px 10px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    white-space: nowrap;
                }
                
                .${this.id}-builder-category:hover {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                .${this.id}-builder-category.active {
                    background-color: var(--color-background, #ffffff);
                    border-bottom: 2px solid var(--color-primary, #007bff);
                    font-weight: bold;
                }
                
                .${this.id}-builder-palette {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 8px;
                    padding: 10px;
                    background-color: var(--color-background-light, #f8f9fa);
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    margin-bottom: 10px;
                    max-height: 120px;
                    overflow-y: auto;
                }
                
                .${this.id}-builder-component {
                    padding: 8px;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    background-color: var(--color-background, #ffffff);
                    cursor: grab;
                    text-align: center;
                    font-size: 13px;
                    transition: background-color 0.2s;
                }
                
                .${this.id}-builder-component:hover {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                .builder-canvas {
                    flex: 1;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    background-color: #f9f9f9;
                    padding: 10px;
                    margin-bottom: 10px;
                    min-height: 150px;
                    position: relative;
                    overflow: auto;
                }
                
                .builder-placeholder {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #adb5bd;
                    text-align: center;
                    font-style: italic;
                }
                
                .builder-node {
                    position: absolute;
                    background-color: var(--color-background, #ffffff);
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    padding: 5px 10px;
                    cursor: grab;
                    user-select: none;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    z-index: 1;
                }
                
                .builder-node.selected {
                    border-color: var(--color-primary, #007bff);
                    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
                }
                
                .builder-output {
                    padding: 10px;
                    background-color: var(--color-background-light, #f8f9fa);
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                
                .builder-output-label {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .builder-output-value {
                    font-family: monospace;
                    padding: 5px;
                    background-color: var(--color-background, #ffffff);
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 2px;
                    min-height: 1.5em;
                }
                
                .action-buttons {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                
                .action-buttons button {
                    padding: 6px 12px;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    background-color: var(--color-background, #ffffff);
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .action-buttons button:hover {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                .action-buttons .clear-button {
                    color: #dc3545;
                }
                
                .action-buttons .use-button {
                    color: var(--color-primary, #007bff);
                    font-weight: bold;
                }
                
                /* Patterns Tab */
                .patterns-header {
                    margin-bottom: 15px;
                }
                
                .patterns-title {
                    margin: 0 0 10px 0;
                    font-size: 16px;
                }
                
                .patterns-search-container {
                    margin-bottom: 10px;
                }
                
                .patterns-search {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                .patterns-list-container {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 10px;
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                }
                
                .patterns-list {
                    height: 100%;
                }
                
                .pattern-category {
                    margin-bottom: 10px;
                }
                
                .${this.id}-pattern-category-header {
                    padding: 8px 10px;
                    background-color: var(--color-background-light, #f8f9fa);
                    border-bottom: 1px solid var(--color-border, #dee2e6);
                    font-weight: bold;
                    cursor: pointer;
                }
                
                .${this.id}-pattern-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 10px;
                    border-bottom: 1px solid var(--color-border, #dee2e6);
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .${this.id}-pattern-item:hover {
                    background-color: var(--color-background-hover, #e9ecef);
                }
                
                .${this.id}-pattern-code {
                    font-family: monospace;
                    margin-right: 10px;
                    flex-shrink: 0;
                }
                
                .pattern-name {
                    flex: 1;
                    font-size: 13px;
                }
                
                .use-pattern-button {
                    padding: 3px 8px;
                    background-color: var(--color-primary, #007bff);
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-left: 10px;
                }
                
                .use-pattern-button:hover {
                    background-color: var(--color-primary-dark, #0056b3);
                }
                
                .pattern-preview-container {
                    padding: 10px;
                    background-color: var(--color-background-light, #f8f9fa);
                    border: 1px solid var(--color-border, #dee2e6);
                    border-radius: 4px;
                }
                
                .preview-header {
                    font-weight: bold;
                    margin-bottom: 10px;
                    border-bottom: 1px solid var(--color-border, #dee2e6);
                    padding-bottom: 5px;
                }
                
                .preview-content {
                    padding: 5px;
                }
                
                .preview-placeholder {
                    color: #adb5bd;
                    text-align: center;
                    font-style: italic;
                    padding: 20px 0;
                }
                
                /* Help Dialog */
                .${this.id}-help-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .${this.id}-help {
                    background-color: var(--color-background, #ffffff);
                    border-radius: 8px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                    padding: 20px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow-y: auto;
                    position: relative;
                }
                
                .${this.id}-help h3 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    border-bottom: 1px solid var(--color-border, #dee2e6);
                    padding-bottom: 10px;
                }
                
                .${this.id}-help h4 {
                    margin-top: 0;
                    color: var(--color-primary, #007bff);
                }
                
                .${this.id}-help-close {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    line-height: 1;
                }
                
                /* Tooltip */
                .${this.id}-tooltip {
                    position: fixed;
                    padding: 5px 10px;
                    background-color: #333;
                    color: white;
                    border-radius: 4px;
                    font-size: 12px;
                    z-index: 1100;
                    pointer-events: none;
                    max-width: 250px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                /* Responsive adjustments */
                @media (max-width: 768px) {
                    .${this.id}-tab-button .tab-label {
                        display: none;
                    }
                    
                    .${this.id}-symbol-category span:nth-child(2) {
                        display: none;
                    }
                    
                    .${this.id}-builder-category span:nth-child(2) {
                        display: none;
                    }
                    
                    .builder-content {
                        height: calc(100% - 30px);
                    }
                    
                    .${this.id}-builder-palette {
                        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
                    }
                }
            `;
            
            document.head.appendChild(style);
        },

        /**
         * Translates SS pattern to Natural Language.
         * @param {string} patternInput - SS pattern to translate
         * @returns {string} - Translated natural language
         */
        translatePatternToText: function(patternInput) {
            // Remove obfuscation markers
            let remaining = patternInput.replace(/(\|\||‖)+/g, ' ');
            remaining = remaining.trim();

            if (!remaining) {
                return '[Input contained only obfuscation markers, whitespace, or was empty. No core pattern found.]';
            }

            let resultParts = [];
            let safetyCounter = 0;
            const maxSafetyLoops = Math.max(5000, patternInput.length * 10);

            while (remaining.length > 0 && safetyCounter < maxSafetyLoops) {
                safetyCounter++;
                let consumedSomething = false;

                // Trim leading whitespace
                remaining = remaining.trimStart();
                if (remaining.length === 0) {
                    consumedSomething = true;
                    break;
                }

                // Try matching known patterns from the lexicon (sorted longest first for greedy match)
                for (const { key: knownPattern, type } of this.state.sortedSSPatternKeys) {
                    // Ensure the known pattern key is a non-empty string for comparison
                    if (typeof knownPattern === 'string' && knownPattern.length > 0 && remaining.startsWith(knownPattern)) {
                        // Find meaning in appropriate lexicon section based on type
                        const meaning = (type === 'composite' && this.state.lexicon.compositePatterns[knownPattern] !== undefined) ? this.state.lexicon.compositePatterns[knownPattern] :
                                        (type === 'tag' && this.state.lexicon.tagsAndStates[knownPattern] !== undefined) ? this.state.lexicon.tagsAndStates[knownPattern] :
                                        (type === 'structural' && this.state.lexicon.structuralElements[knownPattern] !== undefined) ? this.state.lexicon.structuralElements[knownPattern] :
                                        (type === 'core' && this.state.lexicon.coreSymbols[knownPattern] !== undefined) ? this.state.lexicon.coreSymbols[knownPattern] :
                                        undefined; // If not found in expected place or type is unknown

                        if (meaning !== undefined) {
                            // For structural elements and core symbols, if they are single characters
                            // check if they might be operators in this context (requires more sophisticated parsing)
                            // For this simple lookup, just push the definition
                            resultParts.push(meaning);
                        } else {
                             // Fallback for defined keys that somehow don't map
                            resultParts.push(`[Error: Meaning missing for lexicon key "${knownPattern}" of type "${type}"]`);
                            console.warn(`[${this.id}] Lexicon definition missing for key "${knownPattern}" of type "${type}". Check lexicon source.`);
                        }

                        // Consume the matched portion
                        remaining = remaining.substring(knownPattern.length);
                        consumedSomething = true;
                        break; // Move to the next part of the remaining string
                    }
                }

                // If no known pattern or multi-char element matched, check for single characters
                if (!consumedSomething && remaining.length > 0) {
                     const firstChar = remaining.charAt(0);
                     // Try to match single core symbols AFTER trying longer patterns that might start with them
                    if (this.state.lexicon.coreSymbols[firstChar]) {
                        resultParts.push(this.state.lexicon.coreSymbols[firstChar]);
                         consumedSomething = true;
                         remaining = remaining.substring(1);
                    } else {
                         // Handle other simple cases like whitespace, individual numbers, letters etc.
                        // Process whitespace or other single characters that aren't core symbols
                        const simpleMatch = remaining.match(/^(\s+)|^([\w\d]+)|^(.)/); // Match whitespace, then word/number, then any single char
                        if (simpleMatch) {
                            const segment = simpleMatch[0];
                             let description = null;

                             if (/^\s+$/.test(segment)) {
                                 if (segment.length > 1 || segment.includes('\n')) {
                                    description = `[Whitespace (${segment.length > 1 ? segment.length + ' chars' : '1 char'}, Includes Newline: ${segment.includes('\n')})]`;
                                 } // else: skip single space for cleaner output
                             } else {
                                 // Fallback for any other non-whitespace single character not covered, or unknown word fragments
                                 // Could try looking up in NL map as individual words, but this becomes complex.
                                 // Simplest is to flag as unrecognized symbols or fragment.
                                 if (!/^\s+$/.test(segment) && !this.state.lexicon.coreSymbols[segment]) {
                                     description = `[Unrecognized Fragment/Symbol: "${segment.substring(0, 20)}${segment.length > 20 ? '...' : ''}"]`;
                                     console.warn(`[${this.id}] SS->NL: Encountered unrecognized fragment/symbol sequence. Segment: "${segment}". Remaining start: "${remaining.substring(0, 50)}".`);
                                 }
                             }


                            if (description !== null) {
                                 resultParts.push(description);
                             }
                             consumedSomething = true;
                            remaining = remaining.substring(segment.length);
                        }
                     }
                }


                // Fallback for any unconsumed character - should ideally not be reached if parsing is comprehensive
                if (!consumedSomething && remaining.length > 0) {
                    const firstChar = remaining.charAt(0);
                    resultParts.push(`[Uninterpreted Character: "${firstChar}"]`);
                    console.error(`[${this.id}] SS->NL FATAL PARSING ISSUE: Could not consume leading character despite checks. Char: "${firstChar}". Remaining start: "${remaining.substring(0, 50)}${remaining.length > 50 ? '...' : ''}". Full input: "${patternInput}".`);
                    remaining = remaining.substring(1);
                    consumedSomething = true; // Consume it to avoid infinite loops, even if uninterpreted
                }

                // Check for stuck loop - if nothing was consumed but remaining > 0
                if (!consumedSomething && remaining.length > 0 && safetyCounter < maxSafetyLoops) {
                    console.error(`[${this.id}] SS->NL FATAL PARSING ERROR: Loop stuck, nothing was consumed. This indicates a bug in the parsing logic. Remaining start: "${remaining.substring(0, 100)}${remaining.length > 100 ? '...' : ''}". Full input: "${patternInput}".`);
                    if (remaining.trim().length > 0) {
                        resultParts.push(`[!! INTERNAL PARSING BUG !! Cannot Interpret Remaining Sequence. Start: "${remaining.trim().substring(0, 100)}${remaining.trim().length > 100 ? '...' : ''}"]`);
                    }
                    break; // Force exit
                }


                // Safety check for max iterations (catches extremely complex or buggy cases)
                if (safetyCounter >= maxSafetyLoops) {
                    console.error(`[${this.id}] SS->NL MAX LOOP ITERATIONS (${maxSafetyLoops}) REACHED. Possible infinite loop on complex input or parsing logic bug. Input: "${patternInput}".`);
                    if (remaining.trim().length > 0) {
                        resultParts.push(`[PROCESSING HALTED: Max Iterations Reached. Unprocessed input may remain.]`);
                    }
                    break; // Force exit
                }
            }

            // Join the translated parts with a clear separator
            const separator = '\n⇒ ';
            return resultParts.filter(part => typeof part === 'string' && part.trim().length > 0) // Filter out null or empty parts
                          .join(separator)
                          .trim()
                          || '[Translation produced no recognizable Silent-Structure patterns or symbols.]'; // Fallback if no parts resulted
        },

        /**
         * Translates Natural Language to SS pattern suggestion.
         * @param {string} textInput - Natural language to translate
         * @returns {string} - Suggested SS pattern
         */
        translateTextToPattern: function(textInput) {
            const rawInputText = textInput || '';
            const lowerInputText = rawInputText.toLowerCase();

            let lowerRemaining = lowerInputText;
            let originalRemaining = rawInputText; // Keep original text for untranslated parts

            let patternParts = []; // Array to build the output pattern segments
            let untranslatedFragments = []; // Buffer for consecutive untranslated words

            let safetyCounter = 0; // Counter to prevent infinite loops
            const maxSafetyLoops = Math.max(2000, rawInputText.length * 2); // Safety limit based on input length

            // Helper function to flush untranslated words buffer as a comment block
            const flushUntranslated = () => {
                if (untranslatedFragments.length > 0) {
                    const untranslatedText = untranslatedFragments.join(' ');
                    // Add untranslated fragment as a comment to the pattern output
                    patternParts.push(`[# NL: "${untranslatedText.substring(0, 150)}${untranslatedText.length > 150 ? '...' : ''}"]`);
                    untranslatedFragments = []; // Clear the buffer
                }
            };

            // Main matching loop: continues as long as there's text remaining and safety limit not reached
            while (lowerRemaining.length > 0 && safetyCounter < maxSafetyLoops) {
                safetyCounter++; // Increment safety counter
                let consumedSomething = false; // Flag to check if progress was made in this iteration

                // Trim leading whitespace from both lower and original strings
                const trimmedLower = lowerRemaining.trimStart();
                const trimDiff = lowerRemaining.length - trimmedLower.length;
                lowerRemaining = trimmedLower;
                originalRemaining = originalRemaining.substring(trimDiff).trimStart();


                if (lowerRemaining.length === 0) {
                    consumedSomething = true; // Successfully consumed trailing whitespace
                    break; // Exit loop
                }

                // Try matching known phrases from the sorted NL map (longest first for greedy match)
                for (const knownPhrase of this.state.sortedNLKeys) {
                    if (lowerRemaining.startsWith(knownPhrase)) {
                        flushUntranslated(); // Flush any buffered untranslated text before adding a pattern segment

                        const pattern = this.state.lexicon.nlMap[knownPhrase]; // Get the corresponding SS pattern/symbol
                        patternParts.push(pattern); // Add the pattern segment to the output list

                        const charsToConsume = knownPhrase.length; // Number of characters matched by the phrase
                        lowerRemaining = lowerRemaining.substring(charsToConsume); // Remove matched portion
                        originalRemaining = originalRemaining.substring(charsToConsume); // Remove matched portion from original

                         // Re-trim immediately after consuming a phrase to handle spaces *between* matched phrases
                         const trimmedLowerAfterMatch = lowerRemaining.trimStart();
                         const trimDiffAfterMatch = lowerRemaining.length - trimmedLowerAfterMatch.length;
                         lowerRemaining = trimmedLowerAfterMatch;
                         originalRemaining = originalRemaining.substring(trimDiffAfterMatch).trimStart();


                        consumedSomething = true; // Mark that progress was made
                        break; // Exit the phrase loop and continue the main loop
                    }
                }

                // If no known phrase matched, process the next word
                if (!consumedSomething) {
                    // Match the next contiguous sequence of non-whitespace characters (the "word") from the original text
                    const wordMatch = originalRemaining.match(/^(\S+)/);

                    if (wordMatch) {
                        const word = wordMatch[0]; // The next word
                        untranslatedFragments.push(word); // Add the word to the untranslated buffer

                        const charsToConsume = word.length; // Length of the word
                        lowerRemaining = lowerRemaining.substring(charsToConsume); // Remove corresponding part from lower string
                        originalRemaining = originalRemaining.substring(charsToConsume); // Remove from original string

                        // Trim spaces after consuming a word
                         const trimmedLowerAfterWord = lowerRemaining.trimStart();
                         const trimDiffAfterWord = lowerRemaining.length - trimmedLowerAfterWord.length;
                         lowerRemaining = trimmedLowerAfterWord;
                         originalRemaining = originalRemaining.substring(trimDiffAfterWord).trimStart();


                        consumedSomething = true; // Mark that progress was made
                    }
                    // Note: If wordMatch is null here, it means the remaining text doesn't start with a non-whitespace char,
                    // which should have been caught by the trimStart at the beginning of the loop. This branch
                    // is mainly for robust handling but might indicate an issue if hit frequently with non-empty remaining text.
                }

                // Safety check for stuck loop - If nothing was consumed AND there is still text remaining
                // This indicates an error in the parsing logic where it couldn't make progress.
                if (!consumedSomething && lowerRemaining.length > 0 && safetyCounter < maxSafetyLoops) {
                    flushUntranslated(); // Flush buffer before logging error
                    console.error(`[${this.id}] NL->SS FATAL PARSING ERROR: Loop stuck, could not consume remaining input segment. This indicates a bug in the parser logic. Remaining start (original text): "${originalRemaining.substring(0, 100)}${originalRemaining.length > 100 ? '...' : ''}". Full input: "${rawInputText}".`);
                    // Add an error comment to the output
                    if (originalRemaining.trim().length > 0) {
                        patternParts.push(`[# !! PARSER BUG !! Cannot Translate Remaining Segment. Start (original): "${originalRemaining.trim().substring(0, 100)}${originalRemaining.trim().length > 100 ? '...' : ''}"]`);
                    }
                    break; // Force exit the loop to prevent an infinite loop
                }

                // Safety check for max iterations reached
                if (safetyCounter >= maxSafetyLoops) {
                    flushUntranslated(); // Flush buffer before exiting
                    console.error(`[${this.id}] NL->SS MAX LOOP ITERATIONS (${maxSafetyLoops}) REACHED. This suggests extremely complex input or a severe bug causing inefficient parsing. Input: "${rawInputText}".`);
                    if (originalRemaining.trim().length > 0) {
                        patternParts.push(`[# PROCESSING HALTED: Max Iterations Reached. Unprocessed input may remain.]`);
                    }
                    break; // Force exit
                }
            }

            // Flush any remaining untranslated text in the buffer one last time
            flushUntranslated();

            // Assemble the final output string with explanatory header and footer comments
            // Header provides context on the lookup-based nature of the translation
            const header = '[# --- NL -> SS Translation (Keyword/Phrase-Based Lookup - LIMITED CONTEXT) ---\n' +
                          '# This is NOT true Natural Language Understanding or SS Generation. It\'s a dictionary lookup.\n' +
                          '# It identifies defined keywords/phrases and suggests corresponding SS elements.\n' +
                          '# Sentence structure, grammar, word order (outside defined phrases), and unmapped words are largely ignored.\n' +
                          '# Look for "[# NL: ...]" comments for parts of your text that were not recognized as a defined phrase.\n' +
                          '# ---\n';

            // Filter out any empty or purely whitespace parts resulting from parsing
            const finalPatternParts = patternParts.filter(part => typeof part === 'string' && part.trim().length > 0);

            // Footer provides tips on how to build a proper SS pattern manually
            const footer = finalPatternParts.length === 0 // If no elements were translated
                          ? '\n[# --- No recognized keywords or phrases were found in the input text. ---]'
                          : `\n[# ---\n# Review the suggested SS pattern.\n# This is just a starting point!\n# Manually add structural elements (< >Frames, {}Containers, []Items/States), flow (⇒), relations (≺≻), spatial (∥), logic (IF/LOOP), specific values/states.\n# The *structure* and *co-defined context* (not just tokens) gives SS meaning.\n# ---]`;

            // Join the parts. If no parts were translated, return header and empty body line.
            return header + (finalPatternParts.length > 0 ? finalPatternParts.join('\n') : '[# No elements translated.]') + footer;
        },

        /**
         * Called when the panel is opened.
         * This is where the panel becomes "active" and sets up its interactive behaviors.
         */
        onPanelOpen: function() {
            console.log(`[${this.id}] Panel opened. Attaching listeners and performing initial data fetch/UI update.`);

            // 1. Attach Event Listeners
             this.addEventListeners(); // Attach all complex/interactive listeners

            // 2. Ensure UI is up-to-date based on current direction
            //    This also handles initial visibility of palette and suggestions
            this.updateLabelsAndStyling();

            // 3. Set focus to the primary input area for better user experience
            if (this.dom.inputArea) {
                // Use a slight timeout to ensure the panel has finished its opening animation
                // and the input element is ready to receive focus
                setTimeout(() => {
                    try {
                         this.dom.inputArea.focus();
                         // Ensure the cursor position state is synced with focus
                         this.state._lastCaretPosition = this.dom.inputArea.selectionStart;
                         console.log(`[${this.id}] Focus set to input area.`);
                    } catch(e) {
                         console.error(`[${this.id}] Failed to set focus on inputArea after delay:`, e);
                    }
                }, 100); // Adjust timeout if needed for panel animation
            }
             console.log(`[${this.id}] onPanelOpen complete.`);
        },


        /**
         * Called when the panel is closed.
         * This is where the panel cleans up its interactive behaviors.
         */
        onPanelClose: function() {
            console.log(`[${this.id}] Panel closed. Removing listeners and cleaning up state.`);

            // 1. Remove Event Listeners
            this.removeEventListeners(); // Remove all listeners attached in onPanelOpen

            // 2. Hide any actively displayed temporary UI elements (suggestions, tooltips, dialogs)
            this.hideSuggestions(); // Hide auto-complete suggestions
            if(this.state._tooltipElement) this.state._tooltipElement.style.display = 'none'; // Hide any active tooltip
            this.hideHelp(); // Hide the help dialog if it's open (handles its DOM cleanup too)

            // 3. Clear any specific temporary state variables related to interaction
            //    (_autoCompleteActive, _autoCompleteTimeout handled by hideSuggestions)
            //    (Other temporary states like drag data implicitly cleaned up by browser)

             console.log(`[${this.id}] onPanelClose complete. Component should be non-interactive when closed.`);
        },


        /**
         * Cleans up resources when component is destroyed (e.g., Framework removes the component).
         * This includes things like removing the main panel content, global DOM elements created
         * by this component (like tooltip/help dialogs *if not already handled by hideHelp*),
         * and subscriptions to Framework events (although the Framework usually handles this).
         */
        cleanup: function() {
            console.log(`[${this.id}] Starting comprehensive cleanup process...`);

            // 1. Ensure listeners are removed (just in case onPanelClose wasn't called, though it should be)
             this.removeEventListeners(); // This will stop any active interactions

            // 2. Remove styles added by this specific component instance
            const styleElement = document.getElementById(`${this.id}-styles`);
            if (styleElement) {
                styleElement.remove();
                 console.log(`[${this.id}] Component styles removed.`);
            }

            // 3. Remove global passive DOM elements created by this component
            //    (Tooltip and Help Dialog/Overlay if they exist)
            if (this.state._tooltipElement && this.state._tooltipElement.parentNode) {
                this.state._tooltipElement.parentNode.removeChild(this.state._tooltipElement);
                 this.state._tooltipElement = null;
                 console.log(`[${this.id}] Global tooltip element removed.`);
             }
             // The hideHelp function should handle removal of the dialog/overlay DOM, but double check
            if (this.dom.helpDialog && this.dom.helpDialog.parentNode) {
                 this.dom.helpDialog.parentNode.removeChild(this.dom.helpDialog);
                 this.dom.helpDialog = null;
                 console.log(`[${this.id}] Global help dialog element removed (fallback).`);
            }
             if (this.dom.helpOverlay && this.dom.helpOverlay.parentNode) {
                 this.dom.helpOverlay.parentNode.removeChild(this.dom.helpOverlay);
                 this.dom.helpOverlay = null;
                 console.log(`[${this.id}] Global help overlay element removed (fallback).`);
             }


            // 4. Clear the component's own DOM content if necessary (Framework might handle this)
            if (this.dom.content) {
                 this.dom.content.innerHTML = ''; // Clear inside the panel container
                // Don't remove the content element itself, as Framework manages that container
             }


            // 5. Nullify DOM references (Clear pointers to elements)
            // Iterates over all properties in the 'dom' object and sets them to null
            Object.keys(this.dom).forEach(key => this.dom[key] = null);
             console.log(`[${this.id}] Nullified all DOM references.`);


            // 6. Clean up any other interval/timeout references managed directly by the component
            //    (auto-complete timeout is handled by hideSuggestions, no other persistent timers here)


            console.log(`[${this.id}] Comprehensive cleanup complete. Component resources released.`);
        }
    };

    // Register the component with the Framework
    if (typeof Framework !== 'undefined' && typeof Framework.registerComponent === 'function') {
        Framework.registerComponent(component.id, component);
        console.log(`[${component.id}] Component registered with Framework.`);
    } else {
        // Log an error if the framework isn't ready during registration
        console.error(`[${component.id}] Framework object not available for component registration. Component might not function correctly.`);
    }

})(); // End IIFE (Immediately Invoked Function Expression) to encapsulate scope