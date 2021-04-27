import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';

export interface ApplicationProps extends cdk.StackProps{
  //alb: elb.ApplicationLoadBalancer;
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  //imageTag: string;
  //prodPort: number;
  //testPort: number;
}

export class ApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ApplicationProps) {
    super(scope, id, props);

    // Blue green deploy role
    const glueGreenRole = new iam.Role(this, "blue-green-deployment-role", {
      assumedBy: new iam.ServicePrincipal("codedeploy.amazonaws.com"),
      inlinePolicies: {
        invokeHook: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["lambda:InvokeFunction"],
              resources: ["*"],
            }),
          ]
        })
      }
    });

    /*
    const vpc = new ec2.Vpc(this, "vpc-1");

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'EcsCluster-1', {
      vpc: vpc,
    });*/

    // Add capacity to it
    props.cluster.addCapacity('EcsAutoScalingGroupCapacity-1', {
      instanceType: new ec2.InstanceType("t2.micro"),
      desiredCapacity: 1,
    });

    const imageRepo = ecr.Repository.fromRepositoryName(this, 'repo', 'randserver');
    const tag = "fe1";
    const image = ecs.ContainerImage.fromEcrRepository(imageRepo, tag)

    // create a load balancer
    const alb = new elb.ApplicationLoadBalancer(this, "Alb", {
      vpc: props.vpc,
      internetFacing: true
    });

    const serviceSG = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', { vpc: props.vpc });
    serviceSG.connections.allowFrom(alb, ec2.Port.tcp(5000)); // If not matching with the target group the task set creation will get stuck in infinate loop during cloudFormation deploy


    ////// Set up listener rules ---------------------------------


    // create blue target group 
    const tg1 = new elb.ApplicationTargetGroup(this, "tgBlue", {
      port: 5000,
      vpc: props.vpc,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(5),
      /*healthCheck: {
        interval: cdk.Duration.seconds(5),
        path: '/',
        protocol: elb.Protocol.HTTP,
        healthyHttpCodes: '200',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        timeout: cdk.Duration.seconds(4)
      }*/
    });

    // create green target group 
    const tg2 = new elb.ApplicationTargetGroup(this, "tgGreen", {
      port: 5000,
      vpc: props.vpc,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(5),
      /*healthCheck: {
        interval: cdk.Duration.seconds(5),
        path: '/',
        protocol: elb.Protocol.HTTP,
        healthyHttpCodes: '200',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        timeout: cdk.Duration.seconds(4)
      }*/
    });

    // Create a listeners 

    /*
    const prodListener = new elb.ApplicationListener(this, "prodListener", {
      loadBalancer: alb,
      port: props.prodPort,
      protocol: elb.ApplicationProtocol.HTTP,
      open: true,
      defaultAction: elb.ListenerAction.weightedForward([{
        targetGroup: tg1,
        weight: 100
      }])
    });*/

    const prodListener = alb.addListener("prodListener", {
      port: 80,
      protocol: elb.ApplicationProtocol.HTTP,
      open: true,
      defaultAction: elb.ListenerAction.weightedForward([{
        targetGroup: tg1,
        weight: 100
      }])
    });

    /*
    const testListener = new elb.ApplicationListener(this, "testListener", {
      loadBalancer: alb,
      port: props.testPort,
      protocol: elb.ApplicationProtocol.HTTP,
      open: true,
      defaultAction: elb.ListenerAction.weightedForward([{
        targetGroup: tg1,
        weight: 100
      }])
    });*/

    const testListener = alb.addListener("testListener", {
      port: 9002,
      protocol: elb.ApplicationProtocol.HTTP,
      open: true,
      defaultAction: elb.ListenerAction.weightedForward([{
        targetGroup: tg1,
        weight: 100
      }])
    });

    /////// Service and task definitions

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'EcsTaskDef-1');
    
    const container = taskDefinition.addContainer('CustomContaioner', {
      image: image,
      memoryLimitMiB: 512,
    });
    
    const fargateService = new ecs.CfnService(this, "fargate-service", {
      cluster: props.cluster.clusterName,
      desiredCount: 1,
      deploymentController: { type: ecs.DeploymentControllerType.EXTERNAL },
      propagateTags: ecs.PropagatedTagSource.SERVICE
    });
    fargateService.node.addDependency(tg1);
    fargateService.node.addDependency(tg2);
    fargateService.node.addDependency(prodListener);
    fargateService.node.addDependency(testListener);

    container.addPortMappings({
      containerPort: 5000,
      protocol: ecs.Protocol.TCP
    });

    
    const taskSet = new ecs.CfnTaskSet(this, 'TaskSet', {
      cluster: props.cluster.clusterName,
      service: fargateService.attrName,
      scale: { unit: 'PERCENT', value: 100 },
      taskDefinition: taskDefinition.taskDefinitionArn,
      launchType: ecs.LaunchType.FARGATE,
      loadBalancers: [
        {
          containerName: container.containerName,
          containerPort: container.containerPort,
          targetGroupArn: tg1.targetGroupArn,
        }
      ],
      networkConfiguration: {
        awsVpcConfiguration: {
          assignPublicIp: 'DISABLED',
          securityGroups: [ serviceSG.securityGroupId ],
          subnets: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE }).subnetIds, // subnet defined here instead of in fargate service
        }
      },
    });

    new ecs.CfnPrimaryTaskSet(this, 'PrimaryTaskSet', {
      cluster: props.cluster.clusterName,
      service: fargateService.attrName,
      taskSetId: taskSet.attrId,
    });
    
    
    this.addTransform('AWS::CodeDeployBlueGreen');
    const taskDefLogicalId = this.getLogicalId(taskDefinition.node.defaultChild as ecs.CfnTaskDefinition)
    const taskSetLogicalId = this.getLogicalId(taskSet)
    const tg1LogicalId = this.getLogicalId(tg1.node.defaultChild as elb.CfnTargetGroup);
    const tg2LogicalId = this.getLogicalId(tg2.node.defaultChild as elb.CfnTargetGroup);
    const serviceLogicalId = this.getLogicalId(fargateService);
    const roleLogicalId = this.getLogicalId(glueGreenRole.node.defaultChild as iam.CfnRole);
    
    new cdk.CfnCodeDeployBlueGreenHook(this, 'CodeDeployBlueGreenHook', {
      trafficRoutingConfig: {
        type: cdk.CfnTrafficRoutingType.TIME_BASED_CANARY,
        timeBasedCanary: {
          // Shift 20% of prod traffic, then wait 15 minutes
          stepPercentage: 20,
          bakeTimeMins: 5
        }
      },
      additionalOptions: {
        // After canary period, shift 100% of prod traffic, then wait 30 minutes
        terminationWaitTimeInMinutes: 3
      },
      serviceRole: roleLogicalId,
      applications: [{
        target: {
          type: 'AWS::ECS::Service',
          logicalId: serviceLogicalId
        },
        ecsAttributes: {
          taskDefinitions: [ taskDefLogicalId, taskDefLogicalId + 'Green' ],
          taskSets: [ taskSetLogicalId, taskSetLogicalId + 'Green' ],
          trafficRouting: {
            prodTrafficRoute: {
              type: elb.CfnListener.CFN_RESOURCE_TYPE_NAME,
              logicalId: this.getLogicalId(prodListener.node.defaultChild as elb.CfnListener)
            },
            testTrafficRoute: {
              type: elb.CfnListener.CFN_RESOURCE_TYPE_NAME,
              logicalId: this.getLogicalId(testListener.node.defaultChild as elb.CfnListener)
            },
            targetGroups: [
              tg1LogicalId,
              tg2LogicalId
            ]
          }
        }
      }]
    });
  }
  /*
  private createTrafficRoute(listener: elb.ApplicationListener): cdk.CfnTrafficRoute{
    const trafficRoute: cdk.CfnTrafficRoute = {
      type: elb.CfnListener.CFN_RESOURCE_TYPE_NAME,
      logicalId: this.getLogicalId(listener.node.defaultChild as elb.CfnListener)
    };

    return trafficRoute;
  }*/
  
}
