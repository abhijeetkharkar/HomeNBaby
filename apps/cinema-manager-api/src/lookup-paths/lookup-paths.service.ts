import { Injectable, Logger, Inject } from '@nestjs/common';
import { DynamoDbService } from '../dynamodb/dynamodb.service';
import { LookupPath } from '@cinema-manager/models';

@Injectable()
export class LookupPathsService {
  private readonly logger = new Logger(LookupPathsService.name);

  constructor(
    @Inject(DynamoDbService) private readonly dynamoDbService: DynamoDbService
  ) {}

  async getAll(): Promise<LookupPath[]> {
    this.logger.log('Fetching lookup paths');
    return this.dynamoDbService.scan<LookupPath>(
      this.dynamoDbService.lookupPathsTable
    );
  }

  async addPath(path: string, agentId?: string): Promise<LookupPath> {
    const id = Date.now();
    const item: LookupPath = {
      id,
      path,
      agentId,
    };
    await this.dynamoDbService.putItem(
      this.dynamoDbService.lookupPathsTable,
      item
    );
    this.logger.log(`Added lookup path: ${path} (ID: ${id})`);
    return item;
  }

  async deletePath(id: number | string): Promise<void> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    await this.dynamoDbService.deleteItem(
      this.dynamoDbService.lookupPathsTable,
      { id: isNaN(numId) ? id : numId }
    );
    this.logger.log(`Deleted lookup path ID: ${id}`);
  }
}
