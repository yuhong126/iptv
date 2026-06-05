import socket
import struct
import json
import os
import sys
import asyncio

default_config={
    "PORT":1080,
    "MAX_CONN":100,
    "USERS":[]
}

#第一次启动时初始化配置文件
script_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(script_dir, "config.json")

if not os.path.exists(config_path):
    with open(config_path,'w',encoding='utf-8') as f:
        json.dump(default_config,f,indent=4)
    print(f"[info] Configuration file '{config_path}' does not exist. A default configuration has been created. Please modify it and run again.")
    sys.exit(0)

#读取文件
try:
    with open(config_path,'r',encoding='utf-8') as f:
        config=json.load(f)
except json.JSONDecodeError as e:
    print(f"[error] Configuration file format error: {e}")
    sys.exit(1)

#验证文件完整性
for key in ["PORT","MAX_CONN","USERS"]:
            if key not in config:
                print(f"[error] Missing configuration field: '{key}'")
                sys.exit(1)

PORT=config.get("PORT")
MAX_CONN=config.get("MAX_CONN")
USER={u["username"]:u["password"] for u in config.get("USERS",[])}

async def handle_client(client_socket):
    loop=asyncio.get_running_loop()

    try:
        #协商阶段
        ver_nmethods=await loop.sock_recv(client_socket,2)
        ver,nmethods=struct.unpack("!BB",ver_nmethods)
        if ver!=5:
            await loop.sock_sendall(client_socket,b"\x05\xFF")
            return
        
        methods=await loop.sock_recv(client_socket,nmethods)
        if 0x00 in methods:
            await loop.sock_sendall(client_socket,b"\x05\x00")
            
        elif 0x02 in methods:
            await loop.sock_sendall(client_socket,b"\x05\x02")

            ver=(await loop.sock_recv(client_socket,1))[0]
            ulen=(await loop.sock_recv(client_socket,1))[0]
            uname=(await loop.sock_recv(client_socket,ulen)).decode()
            plen=(await loop.sock_recv(client_socket,1))[0]
            passwd=(await loop.sock_recv(client_socket,plen)).decode()

            if USER.get(uname)==passwd:
                await loop.sock_sendall(client_socket,b"\x01\x00")
            else:
                await loop.sock_sendall(client_socket,b"\x01\x01")
                return
            
        else :
            await loop.sock_sendall(client_socket,b"\x05\xFF")
            return


        #请求阶段,接受CONNECT命令和UDP ASSOCIATE命令
        header=await loop.sock_recv(client_socket,4)
        ver,cmd,_,atyp=struct.unpack("!BBBB",header)

        if atyp==1:
            addr=socket.inet_ntoa(await loop.sock_recv(client_socket,4))
        elif atyp==3:
            length=(await loop.sock_recv(client_socket,1))[0]
            addr=(await loop.sock_recv(client_socket,length)).decode()
        elif atyp==4:
            addr = socket.inet_ntop(socket.AF_INET6, await loop.sock_recv(client_socket, 16))
        else:
           return
        port=struct.unpack("!H",await loop.sock_recv(client_socket,2))[0]
        
        if cmd==1:
            try:
                infos = await loop.getaddrinfo(addr, port, type=socket.SOCK_STREAM)
                family, type_, proto, canonname, sockaddr = infos[0]
                remote = socket.socket(family, type_, proto)
                remote.setblocking(False)
                await loop.sock_connect(remote, sockaddr)

                print(f"[debug] trying to connect to {(addr, port)}")
               
                bind_address = remote.getsockname() 
                address = struct.unpack("!I", socket.inet_aton(bind_address[0]))[0]
                port = bind_address[1]
                reply = struct.pack("!BBBBIH", 5, 0, 0, 1, address, port)
                await loop.sock_sendall(client_socket,reply)
                await forward_data(client_socket,remote)
            except Exception as e:
               print(f"[tcp] TCP connection failed: {e}")
               await loop.sock_sendall(client_socket,b"\x05\x01\x00\x01\x00\x00\x00\x00\x00\x00")
               client_socket.close()
               return

        elif cmd==3:
            try:
                infos = await loop.getaddrinfo(addr, port, type=socket.SOCK_STREAM)
                family, type_, proto, canonname, sockaddr = infos[0]
                udp_sock = socket.socket(family, type_, proto)
                udp_sock.setblocking(False)
                udp_sock.bind(('0.0.0.0', 0)) 
                udp_host, udp_port = udp_sock.getsockname()
                print(f"[udp] Started UDP relay on {udp_host}:{udp_port}")

                address = struct.unpack("!I", socket.inet_aton(udp_host))[0]
                reply = struct.pack("!BBBBIH", 5, 0, 0, 1, address, udp_port)

                await loop.sock_sendall(client_socket,reply)
                client_socket.close()
                await udp_associate(udp_sock,loop) 
            except Exception as e :
                print(f"[error] UDP associate failed: {e}")
                client_socket.close()
                return

        else:
            await loop.sock_sendall(client_socket,b"\x05\x07\x00\x01\x00\x00\x00\x00\x00\x00")
            client_socket.close()
            return
           
    except Exception as e:
        print(f"[error] Exception as {e}")
    finally:
        client_socket.close()

#TCP流量转发
async def forward(src,dst,loop):
    try:
        while True:
            data=await loop.sock_recv(src,4096)
            if not data:
                break
            await loop.sock_sendall(dst,data)
    except Exception as e:
               print(f"[error] Exception occurred during forwarding: {e}")

#TCP协程管理
async def forward_data(sock1,sock2):
    loop=asyncio.get_running_loop()
    t1=asyncio.create_task(forward(sock1,sock2,loop))
    t2=asyncio.create_task(forward(sock2,sock1,loop))
    await asyncio.gather(t1,t2)

    #统一关闭socket
    for s in (sock1, sock2):
        try:
            s.shutdown(socket.SHUT_RDWR)
        except:
            pass
        s.close()  

#UDP
async def udp_associate(udp_sock):
    loop=asyncio.get_running_loop()
    udp_sock.setblocking(False)

    while True:
        try:
            data,addr=await loop.sock_recvfrom(udp_sock,65535)

            rsv,frag,atyp=struct.unpack("!HBB",data[:4])
            if frag!=0:
                continue

            if atyp==1:
                dst_ip=socket.inet_ntoa(data[4:8])
                dst_port=struct.unpack("!H",data[8:10])[0]
                load=data[10:]
            if atyp==3:
                domain_len= data[4]
                dst_ip= data[5:5+domain_len].decode()
                dst_port=struct.unpack("!H", data[5+domain_len:7+domain_len])[0]
                load =data[7+domain_len:]
            else:
                continue

            remote_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            remote_sock.sendto(load, (dst_ip, dst_port))

            # 接收响应
            remote_sock.settimeout(2)
            try:
                resp_data, _ = remote_sock.recvfrom(65535)
            except socket.timeout:
                continue

            # 封装 SOCKS5 UDP 响应
            resp_packet = b'\x00\x00\x01' + socket.inet_aton(dst_ip) + struct.pack('!H', dst_port) + resp_data
            await loop.sock_sendto(udp_sock, resp_packet, addr)

        except Exception as e:
            print(f"[udp] Exception: {e}")


#主函数
async def main():
    server= socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setblocking(False)
    server.bind(('0.0.0.0', PORT))
    server.listen(MAX_CONN)
    print(f"SOCKS5 proxy running on port {PORT}")

    loop=asyncio.get_running_loop()
    while True:
        client_socket=(await loop.sock_accept(server))[0]
        client_socket.setblocking(False)
        asyncio.create_task(handle_client(client_socket))

if __name__ == "__main__":
    asyncio.run(main())