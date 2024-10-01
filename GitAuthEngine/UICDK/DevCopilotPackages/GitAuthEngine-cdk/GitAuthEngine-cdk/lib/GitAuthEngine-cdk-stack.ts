import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';

interface ApiGatewayConstructProps {
  restApiName: string;
  apigatewayName: string;
  allowedOrigins: string[];
  lambdaFunction: lambda.IFunction;
  description?: string;
}

class ApiGatewayConstruct extends Construct {
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // Define API Gateway
    this.apiGateway = new apigateway.RestApi(this, props.apigatewayName, {
      restApiName: props.restApiName,
      defaultCorsPreflightOptions: {
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        allowMethods: ['POST'],
        allowCredentials: true,
        allowOrigins: props.allowedOrigins,
      },
      description: props.description ?? '',
      endpointExportName: 'ServiceRequestAPI',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY,
      defaultIntegration: new apigateway.LambdaIntegration(props.lambdaFunction),
      failOnWarnings: true,
      retainDeployments: false,
      defaultMethodOptions: {
        methodResponses: [{ statusCode: '200' }],
        operationName: 'ServiceRequest',
        requestParameters: {
          'method.request.header.Authorization': true,
          'method.request.header.Content-Type': true,
          'method.request.header.Custom-Header': true,
          'method.request.querystring.myParam': true,
        },
        authorizationType: apigateway.AuthorizationType.NONE,
      },
    });
  }
}

interface AuthLambdaConstructProps extends cdk.StackProps {
  functionName: string;
  handler: string;
  codePath: string;
  vpc: ec2.Vpc;
  securityGroups: ec2.SecurityGroup[];
  environment: { [key: string]: string };
}

class AuthLambdaConstruct extends Construct {
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AuthLambdaConstructProps) {
    super(scope, id);

    // Define Lambda Function
    this.lambdaFunction = new lambda.Function(this, props.functionName, {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: props.handler,
      code: lambda.Code.fromAsset(props.codePath),
      vpc: props.vpc,
      securityGroups: props.securityGroups,
      environment: props.environment,
    });

    // Attach necessary policies
    this.lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:*', 'cognito-idp:*', 'elasticache:*', 'logs:*'],
      resources: ['*'],
    }));
  }
}

interface DynamoDBConstructProps extends cdk.StackProps {
  tableName: string;
  partitionKey: { name: string; type: dynamodb.AttributeType };
}

class DynamoDBConstruct extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBConstructProps) {
    super(scope, id);

    // Define DynamoDB Table
    this.table = new dynamodb.Table(this, props.tableName, {
      tableName: props.tableName,
      partitionKey: props.partitionKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
    });
  }
}

interface CognitoConstructProps extends cdk.StackProps {
  userPoolName: string;
  clientName: string;
}

class CognitoConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

    // Define Cognito User Pool
    this.userPool = new cognito.UserPool(this, props.userPoolName, {
      userPoolName: props.userPoolName,
      selfSignUpEnabled: true,
    });

    // Define Cognito User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, props.clientName, {
      userPool: this.userPool,
    });
  }
}

interface ElastiCacheConstructProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  cacheClusterId: string;
}

class ElastiCacheConstruct extends Construct {
  public readonly cacheCluster: elasticache.CfnCacheCluster;

  constructor(scope: Construct, id: string, props: ElastiCacheConstructProps) {
    super(scope, id);

    // Define ElastiCache Cluster
    this.cacheCluster = new elasticache.CfnCacheCluster(this, props.cacheClusterId, {
      vpcSecurityGroupIds: [props.securityGroup.securityGroupId],
      cacheNodeType: 'cache.t2.micro',
      engine: 'redis',
      numCacheNodes: 1,
      clusterName: props.cacheClusterId,
    });
  }
}

interface CloudWatchConstructProps extends cdk.StackProps {
  logGroupName: string;
}

class CloudWatchConstruct extends Construct {
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: CloudWatchConstructProps) {
    super(scope, id);

    // Define CloudWatch Log Group
    this.logGroup = new logs.LogGroup(this, props.logGroupName, {
      logGroupName: props.logGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}

class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define VPC and Security Group
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 3,
      natGateways: 1,
    });

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });

    // Define DynamoDB Table
    const dynamoDb = new DynamoDBConstruct(this, 'DynamoDBConstruct', {
      tableName: 'MyTable',
      partitionKey: { name: 'ID', type: dynamodb.AttributeType.STRING },
    });

    // Define Cognito User Pool and Client
    const cognitoUserPool = new CognitoConstruct(this, 'CognitoConstruct', {
      userPoolName: 'MyUserPool',
      clientName: 'MyUserPoolClient',
    });

    // Define ElastiCache Cluster
    const elastiCacheCluster = new ElastiCacheConstruct(this, 'ElastiCacheConstruct', {
      vpc,
      securityGroup,
      cacheClusterId: 'MyCacheCluster',
    });

    // Define CloudWatch Log Group
    const cloudWatchLogGroup = new CloudWatchConstruct(this, 'CloudWatchConstruct', {
      logGroupName: 'MyLogGroup',
    });

    // Define Lambda Function
    const authLambda = new AuthLambdaConstruct(this, 'AuthLambdaConstruct', {
      functionName: 'AuthLambdaFunction',
      handler: 'index.handler',
      codePath: 'path/to/your/code',
      vpc,
      securityGroups: [securityGroup],
      environment: {
        DYNAMODB_TABLE: dynamoDb.table.tableName,
        USER_POOL_ID: cognitoUserPool.userPool.userPoolId,
        CACHE_CLUSTER_ID: elastiCacheCluster.cacheCluster.ref,
        LOG_GROUP_NAME: cloudWatchLogGroup.logGroup.logGroupName,
      },
    });

    // Define API Gateway
    new ApiGatewayConstruct(this, 'ApiGatewayConstruct', {
      restApiName: 'MyApiGateway',
      apigatewayName: 'MyApiGatewayName',
      allowedOrigins: ['*'],
      lambdaFunction: authLambda.lambdaFunction,
    });
  }
}

const app = new cdk.App();
new MyStack(app, 'MyStack');
app.synth();