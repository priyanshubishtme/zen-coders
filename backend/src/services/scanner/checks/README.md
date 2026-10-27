# Deterministic checks

Our own checks that run alongside axe-core (source `accessfix`). Each check is a pure function
over the rendered DOM that returns axe-shaped results, so the normalizer and scorer treat it
like any axe rule. Only add a check when axe has no equivalent rule.
