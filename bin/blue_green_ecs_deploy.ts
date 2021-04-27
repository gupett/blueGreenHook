#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
//import { BlueGreenEcsDeployStack } from '../lib/blue_green_ecs_deploy-stack';
import { ApplicationStack } from '../lib/application_stack';
import { ServiceStack } from '../lib/service_stack';

const app = new cdk.App();
//new BlueGreenEcsDeployStack(app, 'BlueGreenEcsDeployStack', {});

const serviceStack = new ServiceStack(app, 'ServiceStack', {});


new ApplicationStack(app, 'FeApplicaionStack', {
  //alb: serviceStack.Alb,
  vpc: serviceStack.Vpc,
  cluster: serviceStack.Cluster,
  //imageTag: "fe1",
  //prodPort: 80,
  //testPort: 9001,
});

/*
new ApplicationStack(app, 'BeApplicaionStack', {
  //alb: serviceStack.Alb,
  vpc: serviceStack.Vpc,
  cluster: serviceStack.Cluster,
  imageTag: "be2",
  prodPort: 81,
  testPort: 9002,
});*/


