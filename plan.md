 src/
    domain/
      todo/
        entities/
          todo.entity.ts
        value-objects/
          todo-id.vo.ts
          todo-title.vo.ts
        repositories/
          todo.repository.ts

    application/
      todo/
        commands/
          create-todo/
          complete-todo/
          delete-todo/
        queries/
          get-todo/
          list-todos/

    infrastructure/
      database/
        mongo/
          mongo.module.ts
          schemas/
            todo.schema.ts
          repositories/
            mongo-todo.repository.ts

    presentation/
      todo/
        todo.controller.ts
        dto/

    app.module.ts
    main.ts

  ## The main rule

  Dependencies should point inward:

  Presentation → Application → Domain
  Infrastructure → Application/Domain

  Your domain should not know about NestJS, MongoDB, Mongoose, HTTP, or decorators.

  ## Entity

  An entity is an object with identity and behavior.

  A Todo remains the same Todo even when its title or completion state changes. Its identity distinguishes it from every
  other Todo.

  export type TodoProps = {
    id: string;
    title: string;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

  export class Todo {
    private constructor(private readonly props: TodoProps) {}

    static create(input: { id: string; title: string }): Todo {
      return new Todo({
        id: input.id,
        title: input.title,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    complete(): void {
      if (this.props.completed) {
        throw new Error('Todo is already completed');
      }

      this.props.completed = true;
      this.props.updatedAt = new Date();
    }

    rename(title: string): void {
      this.props.title = title;
      this.props.updatedAt = new Date();
    }

    get id(): string {
      return this.props.id;
    }

    get title(): string {
      return this.props.title;
    }

    get completed(): boolean {
      return this.props.completed;
    }
  }

  The entity protects business rules. For example, callers should not directly set completed = true; they should call
  complete().

  ## Value object

  A value object represents a value defined by its contents rather than by identity.

  For example, two TodoTitle objects containing "Buy milk" are equivalent. They are not separate entities.

  export class TodoTitle {
    private constructor(private readonly value: string) {}

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

    toString(): string {
      return this.value;
    }

    equals(other: TodoTitle): boolean {
      return this.value === other.value;
    }
  }

  Then the entity uses it:

  type TodoProps = {
    id: TodoId;
    title: TodoTitle;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

  Useful value objects for this app might be:

  - TodoId
  - TodoTitle
  - UserId, if todos belong to users
  - TodoDueDate, if you add deadlines

  Do not create value objects for every primitive automatically. Use them when they contain validation, normalization,
  formatting, or domain meaning.

  ## Repository interface

  The domain/application layer defines what it needs:

  export interface TodoRepository {
    save(todo: Todo): Promise<void>;
    findById(id: TodoId): Promise<Todo | null>;
    findAll(): Promise<Todo[]>;
    delete(id: TodoId): Promise<void>;
  }

  This is only an interface. It does not mention MongoDB.

  The Mongo implementation belongs in infrastructure:

  @Injectable()
  export class MongoTodoRepository implements TodoRepository {
    async save(todo: Todo): Promise<void> {
      // Convert domain entity to Mongo document
    }

    async findById(id: TodoId): Promise<Todo | null> {
      // Load document and convert it back into a Todo
      return null;
    }

    async findAll(): Promise<Todo[]> {
      return [];
    }

    async delete(id: TodoId): Promise<void> {
      // Delete Mongo document
    }
  }

  The conversion between Mongo documents and domain entities is important:

  Mongo document → domain entity
  domain entity → Mongo document

  Do not pass Mongoose documents throughout your application. That couples the entire app to MongoDB.

  ## CQRS

  CQRS separates commands that change state from queries that read state.

  ### Command

  A command expresses an intention to change something:

  export class CreateTodoCommand {
    constructor(
      public readonly title: string,
    ) {}
  }

  The handler contains the use-case orchestration:

  @CommandHandler(CreateTodoCommand)
  export class CreateTodoHandler
    implements ICommandHandler<CreateTodoCommand>
  {
    constructor(
      private readonly todoRepository: TodoRepository,
      private readonly idGenerator: IdGenerator,
    ) {}

    async execute(command: CreateTodoCommand): Promise<string> {
      const title = TodoTitle.create(command.title);

      const todo = Todo.create({
        id: this.idGenerator.generate(),
        title: title.toString(),
      });

      await this.todoRepository.save(todo);

      return todo.id;
    }
  }

  Other commands could be:

  CreateTodoCommand
  CompleteTodoCommand
  RenameTodoCommand
  DeleteTodoCommand

  ### Query

  A query only reads:

  export class ListTodosQuery {
    constructor(
      public readonly completed?: boolean,
    ) {}
  }

  @QueryHandler(ListTodosQuery)
  export class ListTodosHandler
    implements IQueryHandler<ListTodosQuery>
  {
    constructor(private readonly todoRepository: TodoRepository) {}

    execute(query: ListTodosQuery): Promise<Todo[]> {
      return this.todoRepository.findAll();
    }
  }

  A query does not call entity behavior such as todo.complete(). It retrieves and shapes data for the caller.

  For a simple application, commands and queries can use the same Mongo database. CQRS does not require separate databases.
  Separate read models and write models are an optimization you can introduce later.

  ## Controller

  The controller should be thin:

  @Controller('todos')
  export class TodoController {
    constructor(
      private readonly commandBus: CommandBus,
      private readonly queryBus: QueryBus,
    ) {}

    @Post()
    create(@Body() dto: CreateTodoDto) {
      return this.commandBus.execute(
        new CreateTodoCommand(dto.title),
      );
    }

    @Get()
    list() {
      return this.queryBus.execute(new ListTodosQuery());
    }

    @Patch(':id/complete')
    complete(@Param('id') id: string) {
      return this.commandBus.execute(
        new CompleteTodoCommand(id),
      );
    }
  }

  The controller handles HTTP concerns. It should not contain business rules or MongoDB code.

  ## Suggested API contract

  Start with a small contract:

  POST   /todos
  GET    /todos
  GET    /todos/:id
  PATCH  /todos/:id/complete
  PATCH  /todos/:id
  DELETE /todos/:id

  Example request:

  POST /todos

  {
    "title": "Learn Clean Architecture"
  }

  Example response:

  {
    "id": "todo-id",
    "title": "Learn Clean Architecture",
    "completed": false,
    "createdAt": "2026-10-20T10:00:00.000Z"
  }

  Keep the HTTP DTO separate from the domain object:

  export class CreateTodoDto {
    @IsString()
    @IsNotEmpty()
    title!: string;
  }

  DTO validation protects the API boundary. TodoTitle validation protects the domain boundary. Both are useful because the
  domain should remain valid even if it is called from a CLI, test, job, or message consumer instead of HTTP.

  ## NestJS modules

  Eventually, your module can look like this:

  @Module({
    imports: [CqrsModule, MongooseModule.forRoot(process.env.MONGO_URI)],
    controllers: [TodoController],
    providers: [
      CreateTodoHandler,
      CompleteTodoHandler,
      DeleteTodoHandler,
      ListTodosHandler,

      {
        provide: TODO_REPOSITORY,
        useClass: MongoTodoRepository,
      },
    ],
  })
  export class TodoModule {}

  Use a token for the repository:

  export const TODO_REPOSITORY = Symbol('TODO_REPOSITORY');

  Then inject it into handlers:

  constructor(
    @Inject(TODO_REPOSITORY)
    private readonly todoRepository: TodoRepository,
  ) {}

  This keeps the application layer dependent on an abstraction, while the module decides that MongoDB is the implementation.

  ## Recommended implementation order

  1. Create the Todo entity and its rules.
  2. Add TodoTitle and possibly TodoId value objects.
  3. Define TodoRepository.
  4. Implement CreateTodoHandler using an in-memory repository.
  5. Add unit tests for the entity and handlers.
  6. Add MongoDB and MongoTodoRepository.
  7. Add controllers and DTOs.
  8. Add HTTP/e2e tests.
  9. Add authentication or users only after the core todo flow works.

  Start with an in-memory repository. It lets you learn and test Clean Architecture before MongoDB introduces connection,
  schema, and serialization concerns.

  The key separation is:

  Todo entity:
    What rules must always be true?

  Command handler:
    What steps execute a business use case?

  Query handler:
    What data should be read?

  Repository:
    How can the application save or load todos?

  Mongo implementation:
    How are todos represented in MongoDB?

  Controller:
    How does HTTP translate into commands and queries?

  For this project, Clean Architecture and CQRS should remain lightweight. You do not need event sourcing, separate
  databases, microservices, or a complex domain-event system until the application has a real need for them.

