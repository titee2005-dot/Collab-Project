import {Component} from 'react';
export default class GameBoundary extends Component{
 state={failed:false,retry:0};
 static getDerivedStateFromError(){return {failed:true};}
 render(){if(this.state.failed)return <div className="game-error" role="alert"><p>เกมนี้เปิดไม่สำเร็จ ลองใหม่อีกครั้งได้ครับ</p><button className="secondary" onClick={()=>this.setState(s=>({failed:false,retry:s.retry+1}))}>ลองใหม่</button></div>;return <div key={this.state.retry}>{this.props.children}</div>;}
}
