.PHONY: terraform-docker-build  # build infrastructure docker image
.PHONY: terraform-setup  # terraform init for ENVIRONMENT (remote state)
.PHONY: terraform-reconfigure # terraform init -reconfigure
.PHONY: terraform-upgrade # initializes terraform with the latest versions
.PHONY: terraform-format  # format terraform code
.PHONY: terraform-validate  # validate terraform code
.PHONY: terraform-all  # format and validate terraform code
.PHONY: terraform-base  # run an arbitrary terraform COMMAND for ENVIRONMENT
.PHONY: terraform-deploy-dev  # deploy to develop environment
.PHONY: terraform-destroy-dev  # destroy the develop environment
.PHONY: terraform-deploy-prod  # deploy to production environment
.PHONY: terraform-destroy-prod  # destroy the production environment
.PHONY: terraform-clean # removes local created terraform resources

# 統合後の Terraform は単一の infra/（env 毎に 1 state）で管理する。
# app（Python）まわりの install/lint/test/docker-build は apps/automator/Makefile 側。
-include .env
export

SHELL := /bin/bash

ENVIRONMENT ?= dev

INTERACTIVE_FLAG := $(shell [ -t 0 ] && echo "-it")
SSH_SETTINGS=-v ~/.ssh:/root/.ssh:ro -v ~/.ssh/known_hosts:/root/.ssh/known_hosts:ro
LOCAL_HOST_UID := $(shell id -u)
DOCKER_SOCKET_SETTINGS := $(shell if [ -S /run/user/${LOCAL_HOST_UID}/docker.sock ]; then echo "-v /run/user/${LOCAL_HOST_UID}/docker.sock:/var/run/docker.sock:ro"; else echo "-v /var/run/docker.sock:/var/run/docker.sock"; fi)
GOOGLE_APPLICATION_CREDENTIALS_ABS := $(shell if [ -n "$(GOOGLE_APPLICATION_CREDENTIALS)" ]; then echo $(GOOGLE_APPLICATION_CREDENTIALS); fi)
GOOGLE_APPLICATION_CREDENTIALS_CONTAINER := /root/google-credentials.json
GOOGLE_SETTINGS := $(shell if [ -n "$(GOOGLE_APPLICATION_CREDENTIALS_ABS)" ]; then echo "-e GOOGLE_APPLICATION_CREDENTIALS=$(GOOGLE_APPLICATION_CREDENTIALS_CONTAINER) -v $(GOOGLE_APPLICATION_CREDENTIALS_ABS):$(GOOGLE_APPLICATION_CREDENTIALS_CONTAINER):ro"; fi)
# GCP 認証の優先順位（docker はどのケースでも維持）:
#   1. GOOGLE_OAUTH_ACCESS_TOKEN … CI/WIF（google-github-actions/auth の access_token）。
#      GCS backend / google provider とも env を直接読むため -e で渡すだけでよい。
#   2. GOOGLE_APPLICATION_CREDENTIALS … 明示的な鍵ファイル（上の GOOGLE_SETTINGS）。
#   3. ~/.config/gcloud の ADC … ローカル（gcloud auth application-default login）。
GOOGLE_TOKEN_SETTINGS := $(shell if [ -n "$(GOOGLE_OAUTH_ACCESS_TOKEN)" ]; then echo "-e GOOGLE_OAUTH_ACCESS_TOKEN"; fi)
GCLOUD_ADC_SETTINGS := $(shell if [ -z "$(GOOGLE_OAUTH_ACCESS_TOKEN)" ] && [ -z "$(GOOGLE_APPLICATION_CREDENTIALS_ABS)" ] && [ -d "$(HOME)/.config/gcloud" ]; then echo "-v $(HOME)/.config/gcloud:/root/.config/gcloud:ro -e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json"; fi)
# リポジトリルートを /work にマウントし、Terraform の作業ディレクトリは /work/infra。
# app イメージビルドの local-exec が参照する ${path.module}/../apps/automator/app（= /work/apps/automator/app）も
# 同じマウント内に含める。
TERRAFORM_BASE_COMMAND=docker run --rm ${INTERACTIVE_FLAG} --env-file .env -v $(PWD):/work -w /work/infra ${DOCKER_SOCKET_SETTINGS} ${SSH_SETTINGS} ${GOOGLE_SETTINGS} ${GOOGLE_TOKEN_SETTINGS} ${GCLOUD_ADC_SETTINGS} terraform:latest

terraform-docker-build:
	DOCKER_BUILDKIT=1 docker build --pull infra -t terraform:latest

terraform-setup: terraform-docker-build
	$(TERRAFORM_BASE_COMMAND) init -backend-config=environments/${ENVIRONMENT}/backend.conf

terraform-reconfigure: terraform-docker-build
	$(TERRAFORM_BASE_COMMAND) init -backend-config=environments/${ENVIRONMENT}/backend.conf -reconfigure

terraform-upgrade: terraform-docker-build
	$(TERRAFORM_BASE_COMMAND) init -upgrade -backend-config=environments/${ENVIRONMENT}/backend.conf

terraform-format:
	$(MAKE) terraform-setup ENVIRONMENT=$(ENVIRONMENT)
	$(TERRAFORM_BASE_COMMAND) fmt -recursive

terraform-validate: terraform-docker-build
	# validate はバックエンド（GCS state）＝GCP 認証を必要としない。
	# CI で認証情報なしに実行できるよう -backend=false で init する。
	$(TERRAFORM_BASE_COMMAND) init -backend=false
	$(TERRAFORM_BASE_COMMAND) fmt -check -recursive -diff
	$(TERRAFORM_BASE_COMMAND) validate

terraform-all:
	$(MAKE) terraform-format ENVIRONMENT=$(ENVIRONMENT)
	$(MAKE) terraform-validate ENVIRONMENT=$(ENVIRONMENT)

terraform-base:
	$(MAKE) terraform-setup ENVIRONMENT=$(ENVIRONMENT)
	$(TERRAFORM_BASE_COMMAND) ${COMMAND} -var-file=environments/${ENVIRONMENT}/variables.tfvars

terraform-deploy-dev:
	$(MAKE) terraform-base ENVIRONMENT=dev COMMAND="apply ${DEPLOY_COMMAND_EXTENSION}"

terraform-destroy-dev:
	$(MAKE) terraform-base ENVIRONMENT=dev COMMAND="destroy"

terraform-deploy-prod:
	$(MAKE) terraform-base ENVIRONMENT=prod COMMAND="apply ${DEPLOY_COMMAND_EXTENSION}"

terraform-destroy-prod:
	$(MAKE) terraform-base ENVIRONMENT=prod COMMAND="destroy"

terraform-clean:
	find infra -type d -name '.terraform' -exec rm -rf {} +
	find infra -type f -name '.terraform.lock.hcl' -delete
