var assert  = require('assert');
var events  = require('events');
var net     = require('net');
var sinon   = require('sinon');

var Client = require('../lib/client.js');
var Adapter = require('../lib/gitter-adapter.js');

describe('Gitter Adapter', function(){
  var socket, client, adapter;

  beforeEach(function() {
    socket  = new net.Socket();
    client  = new Client(socket);
    adapter = new Adapter(client);
  });

  it('should ignore NICK and return Gitter nick', function() {
    client.authenticated = true;
    client.nick = 'bar'; // obtained after auth
    var spy = sinon.spy();
    var stub = sinon.stub(socket, 'write', spy);
    client.parse('NICK foo');
    assert(spy.calledWith(":bar!bar@irc.gitter.im NICK :bar\r\n"));
  });

  it('should ignore WHO when no parameter is specified', function() {
    client.authenticated = true;
    client.nick = 'bar'; // obtained after auth
    var spy = sinon.spy();
    var stub = sinon.stub(socket, 'write', spy);
    client.parse('WHO');
    assert(spy.calledWith(":bar!bar@irc.gitter.im WHO :\r\n"));
  });

  it('should ignore WHO when a username is specified', function() {
    client.authenticated = true;
    client.nick = 'bar'; // obtained after auth
    var spy = sinon.spy();
    var stub = sinon.stub(socket, 'write', spy);
    client.parse('WHO bar');
    assert(spy.calledWith(":bar!bar@irc.gitter.im WHO :bar\r\n"));
  });

  it('should preserve the order when sending a batch of messages', function() {
    var spy = sinon.spy();
    adapter.sendMessage = spy;
    adapter.setup("fake-token");
    adapter.queueMessage("#chan", "first");
    adapter.queueMessage("#foo", "second");
    adapter.queueMessage("#bar", "third");

    adapter.sendPromiseChain = adapter.sendPromiseChain.then(function() {
      assert(spy.calledThrice);
      assert(spy.firstCall.calledWith("#chan", "first"));
      assert(spy.secondCall.calledWith("#foo", "second"));
      assert(spy.thirdCall.calledWith("#bar", "third"));
    });
    return adapter.sendPromiseChain;
  });

  it('Should report users for who', function() {
    client.authenticated = true;
    client.nick = 'bar'; // obtained after auth
    var spy = sinon.spy();
    var stub = sinon.stub(socket, 'write', spy);
    adapter.sendMessage = spy;
    adapter.setup("fake-token");
    var eventMap = {};
    adapter.subscribeToRoom({
      'uri':'hello',
      'id':'hello-room',
      subscribe:function(){},
      on:function(event, cb) {
        eventMap[event] = cb;
      }
    });
    client.parse('WHO hello');
    eventMap['users']({
      'operation': 'create',
      'model': {
        'username': 'test'
      }
    });
    adapter.sendPromiseChain = adapter.sendPromiseChain.then(function() {
      assert(spy.firstCall.calledWith(':bar!bar@irc.gitter.im WHO :hello\r\n'));
      assert(spy.secondCall.calledWith(':test!test@irc.gitter.im JOIN #hello\r\n'));
      assert(spy.calledTwice);
    });
    return adapter.sendPromiseChain;
  });

  it('Should report users for messages', function() {
    client.authenticated = true;
    client.nick = 'bar'; // obtained after auth
    var spy = sinon.spy();
    var stub = sinon.stub(socket, 'write', spy);
    adapter.sendMessage = spy;
    adapter.setup("fake-token");
    var eventMap = {};
    adapter.subscribeToRoom({
      'uri':'hello',
      'id':'hello-room',
      subscribe:function(){},
      on:function(event, cb) {
        eventMap[event] = cb;
      }
    });
    eventMap['chatMessages']({
      'operation': 'create',
      'model': {
        'fromUser': {
          'username': 'test'
        },
        'text': 'hello',
        'id': 1000,
      },
    });
    adapter.sendPromiseChain = adapter.sendPromiseChain.then(function() {
      assert(spy.firstCall.calledWith(':test!test@irc.gitter.im JOIN #hello\r\n'));
      assert(spy.secondCall.calledWith(':test!test@irc.gitter.im PRIVMSG #hello :hello\r\n'));
      assert(spy.calledTwice);
    });
    return adapter.sendPromiseChain;
  });
});
