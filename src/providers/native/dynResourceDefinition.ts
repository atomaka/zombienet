import { genCmd, genCumulusCollatorCmd } from "../../cmdGenerator";
import {
  PROMETHEUS_PORT,
  RPC_HTTP_PORT,
  P2P_PORT,
  RPC_WS_PORT,
  DEFAULT_COMMAND,
} from "../../constants";
import { getUniqueName } from "../../configGenerator";
import { MultiAddressByNode, Node } from "../../types";
import { getRandomPort } from "../../utils/net-utils";
import { getClient } from "../client";
import { Network } from "../../network";

const fs = require("fs").promises;

export async function genBootnodeDef(
  namespace: string,
  nodeSetup: Node
): Promise<any> {
  const client = getClient();
  const name = nodeSetup.name;
  const {rpcPort, wsPort, prometheusPort} = nodeSetup;
  const ports = await getPorts(rpcPort, wsPort, prometheusPort);
  const portFlags = getPortFlags(ports);

  const cfgPath = `${client.tmpDir}/${name}/cfg`;
  await fs.mkdir(cfgPath, { recursive: true });

  const dataPath = `${client.tmpDir}/${name}/data`;
  await fs.mkdir(dataPath, { recursive: true });

  const command = await genCmd(nodeSetup, cfgPath, dataPath, false, portFlags);

  return {
    metadata: {
      name: "bootnode",
      namespace: namespace,
      labels: {
        name: namespace,
        instance: "bootnode",
        "zombie-role": "bootnode",
        app: "zombienet",
        "zombie-ns": namespace,
      },
    },
    spec: {
      cfgPath: `${client.tmpDir}/${nodeSetup.name}/cfg`,
      ports,
      command,
    },
  };
}

export async function genNodeDef(
  namespace: string,
  nodeSetup: Node
): Promise<any> {
  const client = getClient();
  const name = nodeSetup.name;
  const {rpcPort, wsPort, prometheusPort} = nodeSetup;
  const ports = await getPorts(rpcPort, wsPort, prometheusPort);
  const portFlags = getPortFlags(ports);

  const cfgPath = `${client.tmpDir}/${name}/cfg`;
  await fs.mkdir(cfgPath, { recursive: true });

  const dataPath = `${client.tmpDir}/${name}/data`;
  await fs.mkdir(dataPath, { recursive: true });

  let computedCommand;
  const launchCommand = nodeSetup.command || DEFAULT_COMMAND;
  if( nodeSetup.zombieRole === "cumulus-collator" ) {
    computedCommand = await genCumulusCollatorCmd(launchCommand, nodeSetup, cfgPath, dataPath, false, portFlags);
  } else {
    computedCommand = await genCmd(nodeSetup, cfgPath, dataPath, false, portFlags);
  }

  return {
    metadata: {
      name: nodeSetup.name,
      namespace: namespace,
      labels: {
        "zombie-role": nodeSetup.zombieRole
          ? nodeSetup.zombieRole
          : nodeSetup.validator
          ? "authority"
          : "full-node",
        app: "zombienet",
        "zombie-ns": namespace,
        name: namespace,
        instance: nodeSetup.name,
      },
    },
    spec: {
      cfgPath,
      dataPath,
      ports,
      command: computedCommand,
    },
  };
}

async function getPorts(rpc?: number, ws?:number, prometheus?:number) {
  const ports = [
    {
      containerPort: PROMETHEUS_PORT,
      name: "prometheus",
      flag: "--prometheus-port",
      hostPort: prometheus || await getRandomPort(),
    },
    {
      containerPort: RPC_HTTP_PORT,
      name: "rpc",
      flag: "--rpc-port",
      hostPort: rpc || await getRandomPort(),
    },
    {
      containerPort: RPC_WS_PORT,
      name: "ws",
      flag: "--ws-port",
      hostPort: ws || await getRandomPort(),
    },
    {
      containerPort: P2P_PORT,
      name: "p2p",
      flag: "--port",
      hostPort: await getRandomPort(),
    },
  ];

  return ports;
}

export function replaceNetworkRef(podDef: any, network: Network) {
  // replace command if needed
  if(Array.isArray(podDef.spec.command)) {
    const finalCommand = podDef.spec.command.map((item: string) => network.replaceWithNetworInfo(item));
    podDef.spec.command = finalCommand;
  } else {
    // string
    podDef.spec.command = network.replaceWithNetworInfo(podDef.spec.command);
  }
}

function getPortFlags(ports: any): { [flag: string]: number } {
  const portFlags = ports.reduce((memo: any, portItem: any) => {
    memo[portItem.flag] = portItem.hostPort;
    return memo;
  }, {});
  return portFlags;
}

export function createTempNodeDef(
  name: string,
  image: string,
  chain: string,
  fullCommand: string
) {
  let node: Node = {
    name: getUniqueName("temp"),
    image,
    fullCommand: fullCommand,
    chain,
    validator: false,
    bootnodes: [],
    args: [],
    env: [],
    telemetryUrl: "",
    overrides: [],
    zombieRole: "temp",
  };

  return node;
}
