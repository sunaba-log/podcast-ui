.PHONY: terraform-docker-build  # build the terraform docker image
.PHONY: terraform-init  # initialize terraform for ENVIRONMENT (remote state)
.PHONY: terraform-upgrade  # initialize terraform with provider upgrades
.PHONY: terraform-reconfigure  # terraform init -reconfigure for ENVIRONMENT
.PHONY: terraform-format  # format terraform code
.PHONY: terraform-validate  # check formatting and validate terraform code
.PHONY: terraform-all  # format and validate terraform code
.PHONY: terraform-plan  # show planned infrastructure changes for ENVIRONMENT
.PHONY: terraform-apply  # apply infrastructure changes for ENVIRONMENT
.PHONY: terraform-output  # show terraform outputs for ENVIRONMENT

SHELL := /bin/bash

# 対象環境（dev / prod）。環境ごとに backend と変数ファイルを切り替える。
ENVIRONMENT ?= dev

TERRAFORM_DOCKER_IMAGE := podcast-ui-terraform:latest
GCLOUD_CONFIG_DIR := $(HOME)/.config/gcloud
INTERACTIVE_FLAG := $(shell [ -t 0 ] && echo "-it")

BACKEND_CONFIG := environments/$(ENVIRONMENT)/backend.conf
VAR_FILE := environments/$(ENVIRONMENT)/variables.tfvars

# Application Default Credentials（gcloud auth application-default login）を
# コンテナへ read-only でマウントして認証する。
TERRAFORM_BASE_COMMAND = docker run --rm $(INTERACTIVE_FLAG) \
	-v $(PWD):/work -w /work/infra \
	-v $(GCLOUD_CONFIG_DIR):/root/.config/gcloud:ro \
	-e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json \
	$(TERRAFORM_DOCKER_IMAGE)

terraform-docker-build:
	DOCKER_BUILDKIT=1 docker build --pull infra -t $(TERRAFORM_DOCKER_IMAGE)

# 環境ごとに state バケットが異なるため、init は必ず -reconfigure して
# 対象環境の backend に切り替える。
terraform-init: terraform-docker-build
	$(TERRAFORM_BASE_COMMAND) init -reconfigure -backend-config=$(BACKEND_CONFIG)

terraform-upgrade: terraform-docker-build
	$(TERRAFORM_BASE_COMMAND) init -reconfigure -upgrade -backend-config=$(BACKEND_CONFIG)

terraform-reconfigure: terraform-docker-build
	$(TERRAFORM_BASE_COMMAND) init -reconfigure -backend-config=$(BACKEND_CONFIG)

terraform-format: terraform-docker-build
	$(TERRAFORM_BASE_COMMAND) fmt -recursive

terraform-validate: terraform-init
	$(TERRAFORM_BASE_COMMAND) fmt -check -recursive -diff
	$(TERRAFORM_BASE_COMMAND) validate

terraform-all: terraform-format terraform-validate

terraform-plan: terraform-init
	$(TERRAFORM_BASE_COMMAND) plan -var-file=$(VAR_FILE) $(PLAN_COMMAND_EXTENSION)

terraform-apply: terraform-init
	$(TERRAFORM_BASE_COMMAND) apply -var-file=$(VAR_FILE) $(DEPLOY_COMMAND_EXTENSION)

terraform-output:
	$(TERRAFORM_BASE_COMMAND) output
