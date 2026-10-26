  export abstract class Entity<TProps> {
    protected constructor(
      protected readonly props: TProps,
      private readonly _id: string,
    ) {}

    get id(): string {
      return this._id;
    }

    equals(other: Entity<TProps>): boolean {
      return this.id === other.id;
    }
  }