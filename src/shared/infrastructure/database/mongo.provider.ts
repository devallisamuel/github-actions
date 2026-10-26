import { ConfigService } from "@nestjs/config";
import { Db, MongoClient } from "mongodb";

const MONGO_DB = 'MONGO_DB';

export const MongoProvider = {
    inject: [ConfigService],
    provide: MONGO_DB,
    useFactory: async (configService: ConfigService): Promise<Db> => {
        const uri = configService.getOrThrow<string>('URI');
        const databaseName = configService.getOrThrow<string>('DATABASE_NAME');

        const client = new MongoClient(uri);
        await client.connect();

        return client.db(databaseName)


    }
};