#!/usr/bin/env bash

# Update OpSec

# Update Master

aws cloudformation update-stack --stack-name SB-Foundations --template-body file://master.yml --parameters file://parameters.json --capabilities CAPABILITY_NAMED_IAM