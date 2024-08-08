# syntax=docker/dockerfile:1

FROM node:18.16 AS node-builder

WORKDIR /app

# install typescript, ts-node
RUN npm install -g typescript ts-node

# install foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="$PATH:/root/.foundry/bin"
RUN foundryup

# copy necessary files
COPY ["package.json", "package-lock.json*", "./"]
COPY contracts contracts
COPY common common
COPY deploy deploy
RUN mkdir deployments
COPY deployments/genesis.config.ts deployments/genesis.config.ts
COPY scripts scripts
COPY tsconfig.json .
COPY hardhat.config.ts .

# install npm modules
RUN yarn install

# expose this directory in a volume to access the
# accounts and addresses.json
RUN mkdir deployment
COPY docker/localhost-with-protocol/deploy_contracts.sh .
RUN chmod +x deploy_contracts.sh
RUN bash deploy_contracts.sh

ENTRYPOINT ["anvil", "--host", "0.0.0.0", "--state", "state.json"]
