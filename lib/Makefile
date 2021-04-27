deploy-blue-green-stack-frontend:
	cdk deploy BlueGreenEcsDeployStack --parameters taskDefLogicalId=EcsFeTaskDef1 
	\ --parameters taskSetLogicalId=FeTaskSet --parameters tg1LogicalId=tgFeBlue 
	\ --parameters tg2LogicalId=tgFeGreen --parameters serviceLogicalId=fargateFeService 

deploy-blue-green-stack-backend:
	cdk deploy BlueGreenEcsDeployStack --parameters taskDefLogicalId=EcsBeTaskDef --parameters taskSetLogicalId=BeTaskSet --parameters tg1LogicalId=tgBeBlue --parameters tg2LogicalId=tgBeGreen --parameters serviceLogicalId=fargateBeService 