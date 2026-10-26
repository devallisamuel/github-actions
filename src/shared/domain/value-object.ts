export abstract class ValueObject<T> {
    protected constructor(
      protected readonly value: T,
    ) {}

    abstract getValue(): T 

    abstract equals(other: ValueObject<T>): boolean
}


export class TodoTitle extends ValueObject<string> {
    private constructor(value: string) {
        super(value);
    }

    static create(value: string): TodoTitle {
      const normalized = value.trim();

      if (normalized.length === 0) {
        throw new Error('Todo title cannot be empty');
      }

      if (normalized.length > 200) {
        throw new Error('Todo title cannot exceed 200 characters');
      }

      return new TodoTitle(normalized);
    }

    getValue(): string {
        return this.value;
    }

    equals(other: ValueObject<string>): boolean {
            return (
      this.constructor === other.constructor &&
      this.getValue() === other.getValue()
    );
    }
  }