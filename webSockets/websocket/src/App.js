import React, { Component } from 'react';
import { w3cwebsocket as W3CWebSocket } from "websocket";

const client = new W3CWebSocket('ws://127.0.0.1:8000');

class App extends Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.state = {value: ''};
  }
  componentWillMount() {
    client.onopen = () => {
      console.log('WebSocket Client Connected');
    };
    client.onmessage = (message) => {
   return message
    };
  }
  handleChange(e){
    console.log(e.target.value)
    this.setState({value:e.target.value})
  }
  
  render() {
    return (
      <div>
       <input onChange={this.handleChange}/>
       <div>{this.state.value}</div>
      </div>
    );
  }
}

export default App;

