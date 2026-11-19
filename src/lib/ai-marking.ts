/**
 * Marking what a model wrote, in a machine-readable way (EU AI Act, Article 50(2); owner decision
 * D-01, 2026-11-19). The method, and what is and is not marked, is docs/AI-MARKING.md.
 *
 * Every element that holds text a model wrote carries `data-ai-generated`, whose value names the
 * model and its version:
 *
 *   data-ai-generated="name=Gemma 4 E2B; model=onnx-community/gemma-4-E2B-it-ONNX; revision=main; dtype=q4f16"
 *
 * `name` is the model as the game names it, `model` its repository on the Hugging Face hub, from
 * which the browser downloads it, `revision` the version of that repository the game asks for, and
 * `dtype` the weights' precision. Beside it, `data-ai-source` carries IPTC's term for content made by
 * a trained model, the vocabulary C2PA and IPTC photo metadata use for the same disclosure.
 * Text no model wrote carries no `data-ai-generated` at all.
 *
 * Kept free of imports that reach the interface's language modules: Playwright specs read it in Node.
 */

/** IPTC Digital Source Type: "created by a trained model" (cv.iptc.org/newscodes/digitalsourcetype). */
export const AI_SOURCE_TYPE = 'trainedAlgorithmicMedia';

/**
 * The version of each model's repository the browser downloads. src/lib/brain.ts names no revision,
 * so Transformers.js takes the repository's `main`: the version is whatever `main` holds on the day of
 * the download, and is named as such.
 */
export const MODEL_REVISION = 'main';

/** What a mark needs to know of a model: brain.ts's ModelSpec has these. */
export interface MarkedModel {
  label: string;
  id: string;
  dtype: string;
}

/** The value of `data-ai-generated` for text this model wrote. */
export function aiGenerated(model: MarkedModel): string {
  return `name=${model.label}; model=${model.id}; revision=${MODEL_REVISION}; dtype=${model.dtype}`;
}

/** Read a mark back: the fields of a `data-ai-generated` value, or null if it is not one. */
export function readAiGenerated(value: string | null | undefined): Record<'name' | 'model' | 'revision' | 'dtype', string> | null {
  if (!value) return null;
  const fields = Object.fromEntries(value.split('; ').map((part) => [part.slice(0, part.indexOf('=')), part.slice(part.indexOf('=') + 1)]));
  return fields.name && fields.model && fields.revision && fields.dtype ? (fields as Record<'name' | 'model' | 'revision' | 'dtype', string>) : null;
}

/**
 * Mark an element as holding text this model wrote, or, with no model, as holding none: the
 * attributes are set or removed, never left from an earlier verse.
 */
export function markAiText(el: HTMLElement, model: MarkedModel | null): void {
  if (model) {
    el.setAttribute('data-ai-generated', aiGenerated(model));
    el.setAttribute('data-ai-source', AI_SOURCE_TYPE);
  } else {
    el.removeAttribute('data-ai-generated');
    el.removeAttribute('data-ai-source');
  }
}

/** The same mark as HTML attributes, for markup built as a string (the playground's trivia). */
export function aiAttributes(model: MarkedModel | null, escape: (s: string) => string): string {
  return model ? ` data-ai-generated="${escape(aiGenerated(model))}" data-ai-source="${AI_SOURCE_TYPE}"` : '';
}
