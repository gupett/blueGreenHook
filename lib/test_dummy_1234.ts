import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';

import { CfnService, DeploymentControllerType, PropagatedTagSource } from '@aws-cdk/aws-ecs';
import { ExecFileSyncOptions } from 'child_process';

/*
export class BlueGreenEcsDeployStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
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

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, "vpc-1");

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'EcsCluster-1', {
      vpc: vpc,
    });

    // Add capacity to it
    cluster.addCapacity('EcsAutoScalingGroupCapacity-1', {
      instanceType: new ec2.InstanceType("t2.micro"),
      desiredCapacity: 1,
    });


    // Define contianer images
    const imageRepo = ecr.Repository.fromRepositoryName(this, 'repo', 'randserver');
    
    const feTag = 'fe2';
    const imageFe = ecs.ContainerImage.fromEcrRepository(imageRepo, feTag)

    const beTag = 'be1';
    const imageBe = ecs.ContainerImage.fromEcrRepository(imageRepo, beTag)

    // Set up security group to allow comunication between loadbalancer and target group
    const serviceSG = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', { vpc });
    
    // create a load balancer
    const alb = new elb.ApplicationLoadBalancer(this, "Alb-1", {
      vpc: vpc,
      internetFacing: true
    });

    serviceSG.connections.allowFrom(alb, ec2.Port.tcp(5000));

    // Target groups are what links a elb listener to a service

    // Fe target groups
    const feTg1 = new elb.ApplicationTargetGroup(this, "tgFeBlue", {
      port: 5000,
      vpc: vpc,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(5),
    });
    let cfnTg1Fe = feTg1.node.defaultChild as elb.CfnTargetGroup
    cfnTg1Fe.overrideLogicalId('tgFeBlue')

    const feTg2 = new elb.ApplicationTargetGroup(this, "tgFeGreen", {
      port: 5000,
      vpc: vpc,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(5),
    });
    let cfnTg2Fe = feTg2.node.defaultChild as elb.CfnTargetGroup
    cfnTg2Fe.overrideLogicalId('tgFeGreen')

    // Be target groups
    
    const beTg1 = new elb.ApplicationTargetGroup(this, "tgBeBlue", {
      port: 5000,
      vpc: vpc,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(5),
    });
    let cfnTg1Be = beTg1.node.defaultChild as elb.CfnTargetGroup
    cfnTg1Be.overrideLogicalId('tgBeBlue')

    const beTg2 = new elb.ApplicationTargetGroup(this, "tgBeGreen", {
      port: 5000,
      vpc: vpc,
      protocol: elb.ApplicationProtocol.HTTP,
      targetType: elb.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(5),
    });
    let cfnTg2Be = beTg2.node.defaultChild as elb.CfnTargetGroup
    cfnTg2Be.overrideLogicalId('tgBeGreen')
    

    // Create a prod listeners and rules
    const prodListener = alb.addListener("prodListener", {
      port: 80,
      protocol: elb.ApplicationProtocol.HTTP,
      open: true,
      defaultAction: elb.ListenerAction.weightedForward([{
        targetGroup: feTg1,
        weight: 100
      }])
    });

    
    new elb.ApplicationListenerRule(this, "fe-listener-rule", {
      listener: prodListener,
      priority: 1000,
      action: elb.ListenerAction.weightedForward([{
          targetGroup: feTg1,
          weight: 100
      }]),
      conditions: [elb.ListenerCondition.pathPatterns(["/frontend/*"])]
  });

  new elb.ApplicationListenerRule(this, "be-listener-rule", {
      listener: prodListener,
      priority: 1001,
      action: elb.ListenerAction.weightedForward([{
          targetGroup: beTg1,
          weight: 100
      }]),
      conditions: [elb.ListenerCondition.pathPatterns(["/backend/*"])]
  });
  
  // Create a test listeners and rules
  const testListener = alb.addListener("testListener", {
    port: 9002,
    protocol: elb.ApplicationProtocol.HTTP,
    open: true,
    defaultAction: elb.ListenerAction.weightedForward([{
      targetGroup: feTg1,
      weight: 100
    }])
  });

  
  new elb.ApplicationListenerRule(this, "fe-test-listener-rule", {
    listener: testListener,
    priority: 1000,
    action: elb.ListenerAction.weightedForward([{
        targetGroup: feTg1,
        weight: 100
    }]),
    conditions: [elb.ListenerCondition.pathPatterns(["/frontend/*"])]
  });

  new elb.ApplicationListenerRule(this, "be-test-listener-rule", {
      listener: testListener,
      priority: 1001,
      action: elb.ListenerAction.weightedForward([{
          targetGroup: beTg1,
          weight: 100
      }]),
      conditions: [elb.ListenerCondition.pathPatterns(["/backend/*"])]
  });

    /////// Service and task definition for frontend

    const taskDefinitionFe = new ecs.FargateTaskDefinition(this, 'EcsFeTaskDef-1');
    let cfnFeTD = taskDefinitionFe.node.defaultChild as ecs.CfnTaskDefinition
    cfnFeTD.overrideLogicalId('EcsFeTaskDef1')
    
    const feContainer = taskDefinitionFe.addContainer('FeCustomContaioner', {
      image: imageFe,
      memoryLimitMiB: 512,
    });
    
    const fargateFeService = new ecs.CfnService(this, "fargateFeService", {
      cluster: cluster.clusterName,
      desiredCount: 1,
      deploymentController: { type: DeploymentControllerType.EXTERNAL },
      propagateTags: PropagatedTagSource.SERVICE
    });
    fargateFeService.node.addDependency(feTg1);
    fargateFeService.node.addDependency(feTg2);
    fargateFeService.node.addDependency(prodListener);
    fargateFeService.node.addDependency(testListener);
    fargateFeService.overrideLogicalId('fargateFeService')

    feContainer.addPortMappings({
      containerPort: 5000,
      protocol: ecs.Protocol.TCP
    });

    /////// Service and task definition for backend
    
    const taskDefinitionBe = new ecs.FargateTaskDefinition(this, 'EcsBeTaskDef-1');
    let cfnBeTD = taskDefinitionBe.node.defaultChild as ecs.CfnTaskDefinition
    cfnBeTD.overrideLogicalId('EcsBeTaskDef1')
    
    const beContainer = taskDefinitionBe.addContainer('CustomBeContaioner', {
      image: imageBe,
      memoryLimitMiB: 512,
    });
    
    const fargateBeService = new ecs.CfnService(this, "fargateBeService", {
      cluster: cluster.clusterName,
      desiredCount: 1,
      deploymentController: { type: DeploymentControllerType.EXTERNAL },
      propagateTags: PropagatedTagSource.SERVICE
    });
    fargateBeService.node.addDependency(beTg1);
    fargateBeService.node.addDependency(beTg2);
    fargateBeService.node.addDependency(prodListener);
    fargateBeService.node.addDependency(testListener);
    fargateBeService.overrideLogicalId('fargateBeService')

    beContainer.addPortMappings({
      containerPort: 5000,
      protocol: ecs.Protocol.TCP
    }); 
    
    // be code

    // Blue green deployment part

    // Task sets are needed in order for a service to run multiple task definitions.
    // Normaly a service runs one or many instances of a task definition, which means it is always the same container running
    // A task definition configures the container so that ecs can run it.
    // Since two different task definitions needs to be running at the same time when we performe blue green deployment we need to have two 
    // different task sets running in a service in order for the service to to different task definition. Note that each task definition can 
    // have multiple instances

    // --------------------------------------- Fe taskSet ------------------------------------------
    const feTaskSet = new ecs.CfnTaskSet(this, 'FeTaskSet', {
      cluster: cluster.clusterName,
      service: fargateFeService.attrName,
      scale: { unit: 'PERCENT', value: 100 },
      taskDefinition: taskDefinitionFe.taskDefinitionArn,
      launchType: ecs.LaunchType.FARGATE,
      loadBalancers: [
        {
          containerName: feContainer.containerName,
          containerPort: feContainer.containerPort,
          targetGroupArn: feTg1.targetGroupArn,
        }
      ],
      networkConfiguration: {
        awsVpcConfiguration: {
          assignPublicIp: 'DISABLED',
          securityGroups: [ serviceSG.securityGroupId ],
          subnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE }).subnetIds, // subnet defined here instead of in fargate service
        }
      },
    });
    feTaskSet.overrideLogicalId('FeTaskSet');
    
    new ecs.CfnPrimaryTaskSet(this, 'FePrimaryTaskSet', {
      cluster: cluster.clusterName,
      service: fargateFeService.attrName,
      taskSetId: feTaskSet.attrId,
    });
    

    // ------------------------------------------ Be taskSet -------------------------------------------
    
    const beTaskSet = new ecs.CfnTaskSet(this, 'BeTaskSet', {
      cluster: cluster.clusterName,
      service: fargateBeService.attrName,
      scale: { unit: 'PERCENT', value: 100 },
      taskDefinition: taskDefinitionBe.taskDefinitionArn,
      launchType: ecs.LaunchType.FARGATE,
      loadBalancers: [
        {
          containerName: beContainer.containerName,
          containerPort: beContainer.containerPort,
          targetGroupArn: beTg1.targetGroupArn,
        }
      ],
      networkConfiguration: {
        awsVpcConfiguration: {
          assignPublicIp: 'DISABLED',
          securityGroups: [ serviceSG.securityGroupId ],
          subnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE }).subnetIds, // subnet defined here instead of in fargate service
        }
      },
    });
    beTaskSet.overrideLogicalId('BeTaskSet');

    
    new ecs.CfnPrimaryTaskSet(this, 'BePrimaryTaskSet', {
      cluster: cluster.clusterName,
      service: fargateBeService.attrName,
      taskSetId: beTaskSet.attrId,
    });
    
    // CodeDeploy hook and transform to configure the blue-green deployments.
    //
    // Note: Stack updates that contain changes in the template to both ECS resources and non-ECS resources
    // will result in the following error from the CodeDeploy hook:
    //   "Additional resource diff other than ECS application related resource update is detected,
    //    CodeDeploy can't perform BlueGreen style update properly."
    // In this case, you can either:
    // 1) Separate the resources into multiple, separate stack updates: First, deploy the changes to the
    //    non-ECS resources only, using the same container image tag during the template synthesis that is
    //    currently deployed to the ECS service.  Then, deploy the changes to the ECS service, for example
    //    deploying a new container image tag.  This is the best practice.
    // 2) Temporarily disable the CodeDeploy blue-green hook: Comment out the CodeDeploy transform and hook
    //    code below.  The next stack update will *not* deploy the ECS service changes in a blue-green fashion.
    //    Once the stack update is completed, uncomment the CodeDeploy transform and hook code to re-enable
    //    blue-green deployments.
    
    */
    /*
    const taskDefLogicalIdParam = new cdk.CfnParameter(this, "taskDefLogicalId", {
      type: "String",
      default: this.getLogicalId(taskDefinitionFe.node.defaultChild as ecs.CfnTaskDefinition),
      description: "Task definition"
    });

    const taskSetLogicalIdParam = new cdk.CfnParameter(this, "taskSetLogicalId", {
      type: "String",
      default: this.getLogicalId(feTaskSet),
      description: "Task set"
    });

    const tg1LogicalIdParam = new cdk.CfnParameter(this, "tg1LogicalId", {
      type: "String",
      default: this.getLogicalId(feTg1.node.defaultChild as elb.CfnTargetGroup),
      description: "Target group 1"
    });

    const tg2LogicalIdParam = new cdk.CfnParameter(this, "tg2LogicalId", {
      type: "String",
      default: this.getLogicalId(feTg2.node.defaultChild as elb.CfnTargetGroup),
      description: "Target group 2"
    });

    const serviceLogicalIdParam = new cdk.CfnParameter(this, "serviceLogicalId", {
      type: "String",
      default: this.getLogicalId(fargateFeService),
      description: "Service"
    });
    */
    
    /*
    this.addTransform('AWS::CodeDeployBlueGreen');
    
    const taskDefLogicalId = this.getLogicalId(taskDefinitionFe.node.defaultChild as ecs.CfnTaskDefinition);
    //const taskDefLogicalId = taskDefLogicalIdParam.valueAsString;
    const taskSetLogicalId = this.getLogicalId(feTaskSet);
    //const taskSetLogicalId = taskSetLogicalIdParam.valueAsString;
    //const listenerLogicalId = this.getLogicalId(prodListener.node.defaultChild as elb.CfnListener);
    //const testListenerLogicalId = this.getLogicalId(testListener.node.defaultChild as elb.CfnListener);
    const tg1LogicalId = this.getLogicalId(feTg1.node.defaultChild as elb.CfnTargetGroup);
    //const tg1LogicalId = tg1LogicalIdParam.valueAsString;
    const tg2LogicalId = this.getLogicalId(feTg2.node.defaultChild as elb.CfnTargetGroup);
    //const tg2LogicalId = tg2LogicalIdParam.valueAsString;
    const serviceLogicalId = this.getLogicalId(fargateFeService);
    //const serviceLogicalId = serviceLogicalIdParam.valueAsString;
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
        terminationWaitTimeInMinutes: 30
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
            prodTrafficRoute: this.createTrafficRoute(prodListener),
            testTrafficRoute: this.createTrafficRoute(testListener),
            targetGroups: [
              tg1LogicalId,
              tg2LogicalId
            ]
          }
        }
      }]
    });
  }

  private createTrafficRoute(listener: elb.ApplicationListener): cdk.CfnTrafficRoute{
    const trafficRoute: cdk.CfnTrafficRoute = {
      type: elb.CfnListener.CFN_RESOURCE_TYPE_NAME,
      logicalId: this.getLogicalId(listener.node.defaultChild as elb.CfnListener)
    };

    return trafficRoute;
  }
}
*/