import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';


export class ServiceStack extends cdk.Stack {
  public readonly Alb: elb.ApplicationLoadBalancer;
  public readonly Vpc: ec2.Vpc;
  public readonly Cluster: ecs.Cluster;
  

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, "vpc-1");
    this.Vpc = vpc;

    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, 'EcsCluster-1', {
      vpc: vpc,
    });
    this.Cluster = cluster;

    // Add capacity to it
    cluster.addCapacity('EcsAutoScalingGroupCapacity-1', {
      instanceType: new ec2.InstanceType("t2.micro"),
      desiredCapacity: 1,
    });
    
    /*
    // create a load balancer
    const alb = new elb.ApplicationLoadBalancer(this, "Alb", {
      vpc: vpc,
      internetFacing: true
    });
    this.Alb = alb;
    */
  }
}
