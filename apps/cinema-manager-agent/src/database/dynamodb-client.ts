import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { MovieMetadata } from '../processors/movie-processor';

export class DynamoDbClient {
  private docClient: DynamoDBDocumentClient;
  private tableName = 'cinema-manager-movies';

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async saveMovie(movie: MovieMetadata): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...movie,
        agentId: this.getAgentId(),
        updatedAt: new Date().toISOString(),
      },
    });

    try {
      await this.docClient.send(command);
      console.log(`Movie saved to DynamoDB: ${movie.title}`);
    } catch (error) {
      console.error('Error saving movie to DynamoDB:', error);
      throw error;
    }
  }

  async getMovieByPath(filePath: string): Promise<MovieMetadata | null> {
    // Generate the same ID that would be created for this path
    const crypto = require('crypto');
    const id = crypto.createHash('md5').update(filePath).digest('hex');

    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        id,
        agentId: this.getAgentId(),
      },
    });

    try {
      const response = await this.docClient.send(command);
      return response.Item as MovieMetadata || null;
    } catch (error) {
      console.error('Error getting movie from DynamoDB:', error);
      return null;
    }
  }

  async deleteMovie(movieId: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        id: movieId,
        agentId: this.getAgentId(),
      },
    });

    try {
      await this.docClient.send(command);
      console.log(`Movie deleted from DynamoDB: ${movieId}`);
    } catch (error) {
      console.error('Error deleting movie from DynamoDB:', error);
      throw error;
    }
  }

  async getAllMovies(): Promise<MovieMetadata[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'agent-index', // Assuming we have a GSI on agentId
      KeyConditionExpression: 'agentId = :agentId',
      ExpressionAttributeValues: {
        ':agentId': this.getAgentId(),
      },
    });

    try {
      const response = await this.docClient.send(command);
      return (response.Items as MovieMetadata[]) || [];
    } catch (error) {
      console.error('Error getting all movies from DynamoDB:', error);
      return [];
    }
  }

  private getAgentId(): string {
    // Use machine name + username as unique agent identifier
    const os = require('os');
    return `${os.hostname()}-${os.userInfo().username}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          id: 'test-connection',
          agentId: this.getAgentId(),
        },
      });

      await this.docClient.send(command);
      console.log('DynamoDB connection test successful');
      return true;
    } catch (error) {
      console.error('DynamoDB connection test failed:', error);
      return false;
    }
  }
}
