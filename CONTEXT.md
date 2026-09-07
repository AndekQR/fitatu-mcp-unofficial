# Fitatu MCP

This context describes the Fitatu account data and actions exposed through the MCP server.

## Language

**Body Measurement**:
A set of body values identified by an explicit calendar date, including optional weight, circumferences, and body fat percentage.
_Avoid_: Measurement history, body metrics

**Body Measurement Update**:
A non-empty set of body values merged into a Body Measurement; omitted values remain unchanged and existing values cannot be cleared.
_Avoid_: Body measurement replacement, body measurement deletion

**Body Measurement Lookup**:
The result of looking up one explicit date, which is either a found Body Measurement or an ordinary missing state.
_Avoid_: Not-found error

**Body Measurement Value**:
One of `weight`, `neck`, `chest`, `waist`, `stomach`, `hips`, `thigh`, `calf`, `biceps`, or `fatPercentage`, represented to at most two decimal places; `stomach` denotes abdominal circumference and `biceps` denotes upper-arm circumference.
_Avoid_: abdomen, upperArm, bodyFatPercentage

**Measurement Units**:
The required weight and body-size units configured for the authenticated Fitatu account and shared by its Body Measurements. A Body Measurement Update cannot be interpreted when either unit is unavailable.
_Avoid_: Per-request units

**User Settings Snapshot**:
The authenticated user's settings resolved by Fitatu for one calendar date, including editable settings and calculated values.
_Avoid_: User profile, raw settings response

**User Settings Update**:
A non-empty partial change containing only settings that the MCP server explicitly supports; omitted settings remain unchanged.
_Avoid_: Settings replacement, arbitrary settings patch

**Energy Target**:
The user's daily dietary energy goal, either a manually chosen kilocalorie value or a value calculated automatically by Fitatu.
_Avoid_: Calorie limit, calculated energy

**Macronutrient Distribution**:
The percentages of an Energy Target assigned to protein, fat, and carbohydrates; the three percentages total 100 and apply only to a manual Energy Target. Macronutrient weights are derived values rather than user input.
_Avoid_: Macro weights, macronutrient grams

**Water Serving Size**:
The volume in millilitres represented by one default water serving in the user's Fitatu settings.
_Avoid_: Water unit, water capacity
