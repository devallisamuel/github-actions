import { Global, Module } from '@nestjs/common';
import { MongoProvider } from './mongo.provider';

@Global()
@Module({
  imports: [],
  providers: [MongoProvider],
  exports:[MongoProvider]
})
export class MongoModule {}
