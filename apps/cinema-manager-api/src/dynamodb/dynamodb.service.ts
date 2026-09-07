import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDbService {
  private readonly logger = new Logger(DynamoDbService.name);
  private readonly docClient: DynamoDBDocumentClient;

  public readonly moviesTable =
    process.env.MOVIES_TABLE || 'cinema-manager-movies';
  public readonly agentsTable =
    process.env.AGENTS_TABLE || 'cinema-manager-agents';
  public readonly lookupPathsTable =
    process.env.LOOKUP_PATHS_TABLE || 'cinema-manager-lookup-paths';
  public readonly usersTable =
    process.env.USERS_TABLE || 'cinema-manager-users';

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
      },
    });
    this.logger.log('DynamoDbService initialized with region us-east-1');
  }

  async putItem(tableName: string, item: Record<string, any>): Promise<void> {
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
        })
      );
    } catch (error) {
      this.logger.error(`Error putting item into table ${tableName}`, error);
      throw error;
    }
  }

  async getItem<T>(tableName: string, key: Record<string, any>): Promise<T | null> {
    try {
      const response = await this.docClient.send(
        new GetCommand({
          TableName: tableName,
          Key: key,
        })
      );
      return (response.Item as T) || null;
    } catch (error) {
      this.logger.error(`Error getting item from table ${tableName}`, error);
      throw error;
    }
  }

  async deleteItem(tableName: string, key: Record<string, any>): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: key,
        })
      );
    } catch (error) {
      this.logger.error(`Error deleting item from table ${tableName}`, error);
      throw error;
    }
  }

  async scan<T>(
    tableName: string,
    options?: {
      filterExpression?: string;
      expressionAttributeNames?: Record<string, string>;
      expressionAttributeValues?: Record<string, any>;
      indexName?: string;
      limit?: number;
    }
  ): Promise<T[]> {
    try {
      const items: T[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined;

      do {
        const response = await this.docClient.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: options?.filterExpression,
            ExpressionAttributeNames: options?.expressionAttributeNames,
            ExpressionAttributeValues: options?.expressionAttributeValues,
            IndexName: options?.indexName,
            Limit: options?.limit,
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (response.Items) {
          items.push(...(response.Items as T[]));
        }

        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey && (!options?.limit || items.length < options.limit));

      return items;
    } catch (error) {
      this.logger.error(`Error scanning table ${tableName}`, error);
      throw error;
    }
  }

  async query<T>(
    tableName: string,
    params: {
      keyConditionExpression: string;
      expressionAttributeNames?: Record<string, string>;
      expressionAttributeValues: Record<string, any>;
      indexName?: string;
      limit?: number;
    }
  ): Promise<T[]> {
    try {
      const response = await this.docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: params.keyConditionExpression,
          ExpressionAttributeNames: params.expressionAttributeNames,
          ExpressionAttributeValues: params.expressionAttributeValues,
          IndexName: params.indexName,
          Limit: params.limit,
        })
      );
      return (response.Items as T[]) || [];
    } catch (error) {
      this.logger.error(`Error querying table ${tableName}`, error);
      throw error;
    }
  }
}
