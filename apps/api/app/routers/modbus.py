"""Modbus TCP helpers: TCP reachability and single-point reads (pymodbus on the server)."""

from __future__ import annotations

import socket
from enum import Enum
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field
from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ConnectionException, ModbusException

router = APIRouter(prefix="/modbus", tags=["modbus"])

_MODBUS_TIMEOUT_S = 5


class TcpCheckIn(BaseModel):
    host: str = Field(..., min_length=1, max_length=253)
    port: int = Field(502, ge=1, le=65535)


class TcpCheckOut(BaseModel):
    ok: bool
    message: str


class RegisterKind(str, Enum):
    coil = "coil"
    discrete_input = "discrete_input"
    holding = "holding"
    input_register = "input_register"


class PollIn(BaseModel):
    host: str = Field(..., min_length=1, max_length=253)
    port: int = Field(502, ge=1, le=65535)
    unit_id: int = Field(1, ge=0, le=255)
    register_type: RegisterKind
    address: int = Field(..., ge=0, le=65535)


class PollOut(BaseModel):
    ok: bool
    message: str
    values: Optional[List[int]] = None


@router.post("/tcp-check", response_model=TcpCheckOut)
def tcp_check(body: TcpCheckIn) -> TcpCheckOut:
    try:
        with socket.create_connection((body.host, body.port), timeout=_MODBUS_TIMEOUT_S):
            pass
    except OSError as e:
        return TcpCheckOut(ok=False, message=f"TCP connect failed: {e}")
    return TcpCheckOut(ok=True, message=f"TCP connected to {body.host}:{body.port}")


@router.post("/poll", response_model=PollOut)
def poll_register(body: PollIn) -> PollOut:
    try:
        with ModbusTcpClient(host=body.host, port=body.port, timeout=_MODBUS_TIMEOUT_S) as client:
            unit = body.unit_id
            addr = body.address
            rt = body.register_type
            if rt is RegisterKind.coil:
                rr = client.read_coils(addr, count=1, slave=unit)
            elif rt is RegisterKind.discrete_input:
                rr = client.read_discrete_inputs(addr, count=1, slave=unit)
            elif rt is RegisterKind.holding:
                rr = client.read_holding_registers(addr, count=1, slave=unit)
            else:
                rr = client.read_input_registers(addr, count=1, slave=unit)

            if rr.isError():
                return PollOut(ok=False, message=f"Modbus exception: {rr}", values=None)

            if rt in (RegisterKind.coil, RegisterKind.discrete_input):
                bits = getattr(rr, "bits", None)
                if not bits:
                    return PollOut(ok=False, message="Empty coil/discrete response", values=None)
                v = 1 if bits[0] else 0
                msg = f"{rt.value} address={addr} unit={unit} -> [{v}]"
                return PollOut(ok=True, message=msg, values=[v])

            regs = getattr(rr, "registers", None)
            if not regs:
                return PollOut(ok=False, message="Empty register response", values=None)
            msg = f"{rt.value} address={addr} unit={unit} -> {list(regs)}"
            return PollOut(ok=True, message=msg, values=list(regs))
    except ConnectionException as e:
        return PollOut(ok=False, message=str(e), values=None)
    except ModbusException as e:
        return PollOut(ok=False, message=str(e), values=None)
    except OSError as e:
        return PollOut(ok=False, message=f"Network error: {e}", values=None)
