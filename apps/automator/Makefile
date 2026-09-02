.PHONY: all
.PHONY: install  # install dependencies including development
.PHONY: lock  # re-lock dependendencies without updating them
.PHONY: upgrade  # upgrade uv and dependencies
.PHONY: lint  # executes various style and static code analysis tools
.PHONY: format  # format the code
.PHONY: fix  # format the code and apply save fixes discovered by static code analysis tools
.PHONY: test  # executs pytest
.PHONY: clean  # clean tool artifacts and virtualenv
.PHONY: docker-build  # build a docker image.

# Terraform（インフラ）はリポジトリルートの Makefile（infra/ 一元管理）に集約した。
# ここは app（Python）の install/lint/test/docker-build のみを扱う。
-include .env
export

SHELL := /bin/bash

SYSTEMS_DOCKER = app
SYSTEMS = ${SYSTEMS_DOCKER}
ENVIRONMENT ?= dev

SYSTEMS_INSTALL = $(SYSTEMS:%=install-%)
SYSTEMS_CLEAN = $(SYSTEMS:%=clean-%)
SYSTEMS_LINT = $(SYSTEMS:%=lint-%)
SYSTEMS_TEST = $(SYSTEMS:%=test-%)
SYSTEMS_FORMAT = $(SYSTEMS:%=format-%)
SYSTEMS_FIX = $(SYSTEMS:%=fix-%)
SYSTEMS_LOCK = $(SYSTEMS:%=lock-%)
SYSTEMS_UPGRADE = $(SYSTEMS:%=upgrade-%)
SYSTEMS_DOCKER_BUILD = $(SYSTEMS_DOCKER:%=docker-build-%)
SYSTEMS_ALL = $(SYSTEMS:%=all-%)

define SYSTEM_TARGET
$1: $2
	@echo "** $$@ Finished Successfully **"
$2:
	@echo $$@
	@cd $$(@:$1-%=%) && make $$(MAKE_FLAGS) $1
endef

$(eval $(call SYSTEM_TARGET,all,$(SYSTEMS_ALL)))
$(eval $(call SYSTEM_TARGET,install,$(SYSTEMS_INSTALL)))
$(eval $(call SYSTEM_TARGET,lock,$(SYSTEMS_LOCK)))
$(eval $(call SYSTEM_TARGET,upgrade,$(SYSTEMS_UPGRADE)))
$(eval $(call SYSTEM_TARGET,lint,$(SYSTEMS_LINT)))
$(eval $(call SYSTEM_TARGET,format,$(SYSTEMS_FORMAT)))
$(eval $(call SYSTEM_TARGET,fix,$(SYSTEMS_FIX)))
$(eval $(call SYSTEM_TARGET,test,$(SYSTEMS_TEST)))
$(eval $(call SYSTEM_TARGET,clean,$(SYSTEMS_CLEAN)))
$(eval $(call SYSTEM_TARGET,docker-build,$(SYSTEMS_DOCKER_BUILD)))
