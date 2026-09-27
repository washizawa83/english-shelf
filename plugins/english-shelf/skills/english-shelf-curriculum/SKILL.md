---
name: english-shelf-curriculum
description: Manage an English Shelf curriculum and selectively capture meaningful learning progress. Use for study plans, unit study, practice questions or finishing quizzes, curriculum organization, and concise learning records tied to existing local content.
---

# English Shelf Curriculum

Use `get_curriculum_context` to read the current units and independent英文 items. Propose a concise sequence of units with goals and the existing grammar items each unit should reference.

Present the proposal before writing it. After the user approves or explicitly asks to save it:

1. Create units with `create_curriculum_unit` in the proposed order.
2. Relate existing items with `link_grammar_to_unit`; a grammar item may belong to multiple units.
3. Use `reorder_curriculum_units` when the complete order changes.

Do not create duplicate英文 records merely to place them in a unit. Updating a unit must not modify the related grammar records.

## Finishing quiz

When the learner asks to start a unit's finishing quiz, use the unit's objective, rules, examples, and practice questions to give exactly 10 questions, one at a time, in this order:

1. Questions 1-3 are four-option multiple-choice questions about meaning, form, or usage. Include one correct answer and three plausible distractors.
2. Questions 4-7 are English sentence transformation questions. Give a source sentence and one explicit instruction appropriate to the unit, such as changing it into a question, negative sentence, different tense, or a form with a different subject. Vary the transformation instruction across these four questions.
3. Questions 8-10 ask the learner to translate a Japanese sentence into English.

Do not reuse the same source sentence, target answer, or transformation pattern within one quiz. Distribute the questions across the unit's main learning points instead of repeating one form. After each answer, give the correctness and a concise explanation before presenting the next question. Do not reveal later questions or answers in advance. After question 10, summarize the result and weak points, then call `update_curriculum_mastery` with `correct_answers`; the saved mastery is the number correct multiplied by 10.

## Learning records

Create a concise learning record automatically with `create_study_log` only when one of these meaningful milestones occurs:

1. A learner's question is resolved and their understanding is confirmed, such as by an acknowledgement or successful application.
2. A set of curriculum practice questions or a finishing quiz is completed.
3. A unit study session reaches a natural stopping point and has a stable takeaway worth preserving.

Do not record every utterance, interim correction, routine chat, or unanswered explanation. Consolidate related turns into one short record for the learning outcome. Do not create a second record for the same learning in the same conversation; track what this conversation has already saved, and use `list_study_logs` when prior records need to be checked. Use `get_study_log` when the full content of a prior record is needed.

Use a short `title` and a compact `summary` that captures what was learned. Add `mastery_note` only when the learner demonstrated understanding, a quiz exposed a gap, or another useful mastery signal exists. Set `curriculum_unit_id` when the related unit is clear from the study context; omit it rather than guessing when the relationship is unclear.

The `user_note` field is the learner's private editable memo. Never populate or overwrite it during automatic recording. Read it through `list_study_logs` or `get_study_log`, and call `update_study_log_note` only when the learner explicitly asks to change that memo.

If the learner says not to record the learning, including phrases such as 「記録しないで」 or 「これは記録不要」, do not create a record. This opt-out overrides every automatic milestone above.
