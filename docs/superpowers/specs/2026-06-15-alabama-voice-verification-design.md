# Alabama Voice Verification Design

## Goal

Allow Tech Holler's deliberately exaggerated Alabama-redneck narration to remain strong
throughout an article, including its title and dek, without the factual verification
stage mistaking obvious dialect, idioms, jokes, or rural metaphors for unsupported
claims.

## Scope

This change applies to the AI factual-verification prompt used by both OpenAI and
Anthropic. It does not weaken source, attribution, uncertainty, moderation, duplicate,
or completeness gates.

## Verification Behavior

The verifier must distinguish editorial voice from factual content.

Allowed style includes:

- Alabama dialect and regional phrasing.
- Colorful rural idioms and metaphors.
- Clearly figurative statements such as "getting barnyard buzz."
- Mild, non-targeted profanity.
- Humor in titles, deks, headings, and body paragraphs.

The verifier must not fail a draft merely because this style appears in a title or dek.
It should evaluate the literal factual proposition underneath the phrasing.

The verifier must still fail drafts that:

- Invent or overstate factual events, product details, dates, figures, or quotations.
- Present an attributed or unconfirmed claim as established fact.
- Remove required attribution from uncertain assertions.
- Use a metaphor that reasonably communicates a new factual claim rather than obvious
  figurative color.
- Violate the existing Talk Around Town uncertainty, safety, or source requirements.

## Implementation

Extract the shared verification instructions into an exported prompt constant so the
OpenAI and Anthropic paths cannot drift. Extend those instructions with explicit
examples explaining that strong Alabama voice is permitted in every article field and
that obvious phrases such as "barnyard buzz" are non-factual stylistic language.

Both providers will continue receiving the complete research packet and draft. No
verification result parsing, provider selection, call count, or publication behavior
will change.

## Tests

Add focused prompt contract tests that verify:

- The shared verifier explicitly permits Alabama dialect and figurative rural language
  in titles and deks.
- "Barnyard buzz" is identified as an allowed non-factual style example.
- The prompt still requires attribution and blocks invented or overstated facts.
- Both OpenAI and Anthropic verification paths use the same shared instructions.

Run the focused pipeline tests, lint, and production build before deployment. After
deployment, verify production health still reports OpenAI and trigger at most one
targeted article run. A blocked result is acceptable only when it identifies a genuine
factual or gate failure rather than Alabama voice alone.
