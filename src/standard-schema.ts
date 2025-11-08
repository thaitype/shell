import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Validate input against a Standard Schema.
 * @see https://github.com/standard-schema/standard-schema
 */
export async function standardValidate<T extends StandardSchemaV1>(
  schema: T,
  input: StandardSchemaV1.InferInput<T>
): Promise<StandardSchemaV1.InferOutput<T>> {
  let result = schema['~standard'].validate(input);
  if (result instanceof Promise) result = await result;

  // if the `issues` field exists, the validation failed
  if (result.issues) {
    throw new Error(JSON.stringify(result.issues, null, 2));
  }

  return result.value;
}

export type StandardResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: ReadonlyArray<StandardSchemaV1.Issue>;
    };

export async function standardSafeValidate<T extends StandardSchemaV1>(
  schema: T,
  input: StandardSchemaV1.InferInput<T>
): Promise<StandardResult<StandardSchemaV1.InferOutput<T>>> {
  let result = schema['~standard'].validate(input);
  if (result instanceof Promise) result = await result;

  // if the `issues` field exists, the validation failed
  if (result.issues) {
    return {
      success: false,
      error: result.issues,
    };
  }

  return {
    success: true,
    data: result.value as StandardSchemaV1.InferOutput<T>,
  };
}
