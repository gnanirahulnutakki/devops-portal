#!/bin/bash

# Load environment variables from .env file
set -a
source .env
set +a

# Start yarn dev
yarn dev
