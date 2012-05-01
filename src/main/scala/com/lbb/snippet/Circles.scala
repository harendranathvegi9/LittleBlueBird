package com.lbb.snippet
import java.text.SimpleDateFormat
import java.util.Date
import scala.xml.Group
import scala.xml.Node
import scala.xml.NodeSeq
import scala.xml.Text
import com.lbb.entity.Circle
import com.lbb.entity.CircleParticipant
import com.lbb.entity.User
import com.lbb.entity.Circle
import com.lbb.entity.CircleParticipant
import com.lbb.entity.User
import net.liftweb.common._
import net.liftweb.common.Box
import net.liftweb.common.Empty
import net.liftweb.common.Full
import net.liftweb.http.SHtml._
import net.liftweb.http.S._
import net.liftweb.http._
import net.liftweb.http.SessionVar
import net.liftweb.mapper.Ascending
import net.liftweb.mapper.OrderBy
import net.liftweb.util.Helpers._
import com.lbb.TypeOfCircle


object selectedCircle extends SessionVar[Box[Circle]](Empty)
  
object multiplePeople extends RequestVar[List[User]](Nil)

object deletingPeople extends SessionVar[Box[Boolean]](Empty)

// TODO Add alert if user tries to change date to past
// TODO implement "wedding rules" - the recipients CAN see what they're getting
// TODO Bug? If you remove someone from a circle, and things were bought for that person in that circle, won't those gifts fall off that person's list once the event has past?  Possible fix: Set sender to null for all gifts bought in the circle before removing the person from the circle
// TODO Bug? If you delete a circle, won't all the things bought in that circle fall off people's lists once the event has past? Possible fix: same as above
class Circles {
  
  /**
  * Add an event
  */
  def add(xhtml: Group): NodeSeq =
    new Circle().toForm(Empty, saveCircle _) ++ cancelSubmitButtons

  
  
  val cancelSubmitButtons = <div class="row">
      <div class="span1"><a href="/circle/index">Cancel</a></div>
      <div class="span1"><input type="submit" value="Create"/></div></div>
    
    
  /**
   * This is where the user is creating a new event.  In this action, the user is automatically added
   * to the circle (unlike the add method above, where the user isn't)
   */
  // TODO when adding current user, don't assume the user is a receiver
  def add_old(xhtml: Group): NodeSeq = {
          println("addevent: begin")
    var thetype = ""
    var thename = ""
    var thedate = ""
    
    // TODO Some code duplication between this and saveCircle()
    def addCircle() = {
    
      val circle = Circle.create.circleType(thetype).name(thename).date(new SimpleDateFormat("MM/dd/yyyy").parse(thedate))
      circle.save
      
      SessionUser.is match {
        // TODO don't assume the user is a receiver
        // TODO what if error saving circle participant?
        case Full(user) => {
          val s = CircleParticipant.create.circle(circle).person(user).inviter(user).receiver(true).save
          redirectTo("/circle/details/"+circle.id)
        }
        case _ => {
          redirectTo("index")
        }
      }

    }
          
    var chosenType:Box[TypeOfCircle.Value] = Empty
    
    bind("entry", xhtml, 
        "thetype" -> SHtml.selectObj[TypeOfCircle.Value](TypeOfCircle.values.toList.map(v => (v,v.toString)), Empty, selected => chosenType = Full(selected)), 
        "name" -> SHtml.text(thename, thename = _), 
        "thedate" -> SHtml.text(thedate, thedate = _), 
        "submit" -> SHtml.submit("Create", addCircle))
  }
  
  def addbyname(xhtml:Group):NodeSeq = {
    var thename = ""
    def addperson() = {
      val FL = """(\w+)\s+(\w+)""".r
      val FML = """(\w+)\s+([^ ]+)\s+(\w+)""".r
      val people = thename match {
        case FL(f, l) => User.findByName(f, l)
        case FML(f, m, l) => User.findByName(f, l)
        case _ => Nil
      }
      
      people match {
        // more than one person found - present them all with checkboxes?
        case l:List[User] if(l.size > 1) => {
          multiplePeople(l)
          val ref = S.referer openOr "/"
          println("S.referer = "+ref)
          ref
        }
        // just one person found - add this person
        case l:List[User] if(l.size == 1) => {
          selectedCircle.is.open_!.add(List(l.head), SessionUser.is.open_!)
          redirectTo("/circle/details/"+selectedCircle.is.open_!.id.is)
        }
        // no one found - create a new account?
        case _ => {
          S.notice("No one found by this name")
          S.referer openOr "/"
        }
      }
    }
    
    bind("f", xhtml, "name" -> SHtml.text(thename, thename = _), "Add" -> SHtml.submit("Add", addperson))
  }
  
  def addPeopleFromCircle(xhtml:Group):NodeSeq = anotherCircle match {
    // display everyone in the circle with a checkbox by their name
    case Full(circle) => {
      val header = <div class="row">
        <div class="span6">Add these people from {circle.name}</div>
      </div>
      
      val names = for(participant <- circle.participants) yield
        <div class="row">
          <div class="span1">cbox</div>
          <div class="span2">{participant.person.obj.open_!.profilepicOrDefault}</div>
          <div class="span3">{participant.name(participant.person)}</div>
        </div>
      
      (header :: names :: Nil).flatten
    }
    case _ => Nil
  }
  
  /**
   * Display, if they exist, the multiple people having the given name
   */
  def displayMultiplePeople: NodeSeq = {
    multiplePeople.is match {
      case l:List[User] if l.size > 0 => {
        <table>
          {
            for(u <- l) yield {
              <tr><td>{SHtml.button("Add", () => addparticipant(u), "class" -> "btn btn-primary")}</td><td>{u.first + " " + u.last}</td></tr>
            }
          }
        </table>
      }
      case _ => Text("")
    }
  }
  
  private def addparticipant(person:User) = {
    selectedCircle.is.open_!.add(List(person), SessionUser.is.open_!).save
  }
  
  private def circleHeader(c:Circle):NodeSeq = {
    <div class="navbar">
    <div class="navbar-inner">
    <div class="container">
            <div class="brand">{c.name}</div>
            {
              c.deleted.is match {
                case true => Nil
                case false =>
            <ul class="nav pull-right">
              <li>{link("/circle/edit", () => selectedCircle(Full(c)), Text("Edit"))}</li>
              <li class="dropdown"><a href="#" class="dropdown-toggle" data-toggle="dropdown">Delete<b class="caret"></b></a>
                <ul class="dropdown-menu">
                  <li>{link("/circle/confirmDelete", () => selectedCircle(Full(c)), Text("Delete Event"))}</li>
                  <li>{link("/circle/index", () => {selectedCircle(Full(c));deletingPeople(Full(true))}, Text("Delete People"))}</li>
                </ul>
              </li>
              <li class="dropdown"><a href="#" class="dropdown-toggle" data-toggle="dropdown">Add People<b class="caret"></b></a>
                <ul class="dropdown-menu">
                  <li>{link("/circle/addpeoplebyname", () => selectedCircle(Full(c)), Text("By Name"))}</li>
                  {linksToOtherCircles}
                </ul>
              </li>
            </ul>
              }
            }
    </div>
    </div>
    </div>
  }
  
  def linksToOtherCircles:NodeSeq = SessionUser.is match {
    case Full(user) => {
      for(c <- user.circles) yield
        <li>{link("/circle/addpeoplefrom/"+c.circle, () => Empty, Text("From "+c.circleName))}</li>
    }
    case _ => Nil
  }
  
  def expiredInfo(in:NodeSeq):NodeSeq = currentCircle match {      
      case Full(circle) if(circle.isExpired) => <div class="alert alert-info"><h4 class="alert-heading">Event Has Past</h4>This event has past.  Now you can see what you got, or anyone else for that matter.</div>
      case _ => Nil
  }
  
  /**
  * Get the XHTML containing a list of circles
  */
  def show: NodeSeq = {
    (currentCircle, S.uri) match {
      case (_, "/circle/admin") => {
        // the header
        val header = <tr>{Circle.htmlHeaders}<th>Edit</th><th>Delete</th></tr>
        // get and display each of the circles
        val content = Circle.findAll(OrderBy(Circle.id, Ascending)).flatMap(u => <tr>{u.htmlLine}
        <td>{link("/circle/edit", () => selectedCircle(Full(u)), Text("Edit"))}</td>
        <td>{link("/circle/delete", () => selectedCircle(Full(u)), Text("Delete"))}</td>
                                                           </tr>)
        
        (<table> :: header :: content :: </table>).flatten
      }
      
      case (Full(circle), _) => {
        circleHeader(circle)
      }
      
      case _ => redirectTo(S.referer openOr "/")
    }

  }
  
  private def currentCircle = (S.param("circle"), selectedCircle.is) match {
      case (Full(circleId), _) => {
        Circle.findByKey(Integer.parseInt(circleId)) match {
          case Full(circle) => {
            selectedCircle(Full(circle)) // side effect
            Full(circle)
          }
        }
      }
      case (_, ss:Full[Circle]) => {
        ss
      } // case (_, ss:Full[Circle])
      case _ => Empty
    
  }
  
  private def anotherCircle = S.param("anothercircle") match {
      case Full(circleId) => {
        Circle.findByKey(Integer.parseInt(circleId)) match {
          case Full(circle) => {
            Full(circle)
          }
        }
      }
      case _ => Empty
  }
  
  private def onlyOne = currentCircle match {
    case Full(circle) => circle.participants.size == 1
    case _ => false
  }
  
  def showParticipants: NodeSeq = {
    // if there's only one person in the circle, alert the user that they need to add people to share wish lists
    val alertOnlyOne = onlyOne match {
      case true => <div class="alert alert-success"><h4 class="alert-heading">Success - Event Created</h4>Now add people to this event.  That's how you see each others wish lists.</div>
      case false => Nil
    }
    (alertOnlyOne :: showReceivers :: showGivers :: buttons :: Nil).flatten
  }
  
  def showReceivers: NodeSeq = {
    currentCircle match {
      case Full(circle) => circle.participants.filter(cp1 => cp1.receiver.is).flatMap(cp => receiverEntry(cp))
      case Empty => Text("")
    }
  }
  
  private def receiverEntry(cp:CircleParticipant):NodeSeq = { 
    deletingPeople.is match {
      case Full(bool) if bool => {  
        <tr>
        {
          <td>{SHtml.button("Delete", () => cp.delete_!, "class" -> "btn btn-danger")}</td>
          <td>{cp.person.obj.open_!.profilepicOrDefault}</td>
          <td width="100%">{link("/giftlist/"+cp.circle.is+"/"+cp.person.is, () => Empty, cp.name(cp.person))}</td>
        }
        </tr>
      }
      case _ => {  
        <tr>
        {
          <td>{cp.person.obj.open_!.profilepicOrDefault}</td>
          <td width="100%">{link("/giftlist/"+cp.circle.is+"/"+cp.person.is, () => Empty, cp.name(cp.person))}</td>
        }
        </tr>
      }
    } // deletingPeople.is match
  }
  
  private def giverEntry(cp:CircleParticipant) = {   
    deletingPeople.is match {
      case Full(bool) if bool => {  
        <tr>
        {
          <td>{SHtml.button("Delete", () => cp.delete_!, "class" -> "btn btn-danger")}</td>
          <td>{cp.person.obj.open_!.profilepicOrDefault}</td>
          <td width="100%">{cp.name(cp.person)}</td>
        }
        </tr>
      }
      case _ => {  
        <tr>
        {
          <td>{cp.person.obj.open_!.profilepicOrDefault}</td>
          <td width="100%">{cp.name(cp.person)}</td>
        }
        </tr>
      }
    } // deletingPeople.is match
  }
  
  /**
   * Don't show the givers as links - no point
   */
  def showGivers: NodeSeq = {
    currentCircle match {
      case Full(circle) => circle.participants.filter(cp1 => !cp1.receiver.is).flatMap(cp => giverEntry(cp))
      case Empty => Text("")
    }
  }
  
  /**
   * responsible for displaying buttons on the circle index page like the "Finished" button
   * (finished removing people)
   */
  def buttons:NodeSeq = {  
    deletingPeople.is match {
      case Full(bool) if bool => {  
        <tr>
        {
          <td width="100%" colspan="3">{SHtml.button("Finished", () => deletingPeople(Empty), "class" -> "btn btn-primary")}</td>
        }
        </tr>
      }
      case _ => <tr><td width="100%" colspan="2"></td></tr>
    } // deletingPeople.is match
  }
  
  /**
  * Edit a user
  */
  def edit(xhtml: Group): NodeSeq =
    selectedCircle.map(_.
                   // get the form data for the circle and when the form
                   // is submitted, call the passed function.
                   // That means, when the user submits the form,
                   // the fields that were typed into will be populated into
                   // "circle" and "saveCircle" will be called. The
                   // form fields are bound to the model's fields by this
                   // call.
                   toForm(Empty, saveCircle _) ++ cancelSubmitButtons

                   // bail out if the ID is not supplied or the circle not found
    ) openOr {error("circle not found"); redirectTo("/circle/index")}
  
  
  // called when the form is submitted
  private def saveCircle(circle: Circle) = circle.validate match {
    // no validation errors, save the circle, and go
    // back to the "list" page
    case Nil => {
      if(circle.save && selectedCircle.is==Empty) {
        selectedCircle(Full(circle))
      }
      SessionUser.is match {
        // TODO don't assume the user is a receiver
        // TODO what if error saving circle participant?
        case Full(user) => {
          val s = CircleParticipant.create.circle(circle).person(user).inviter(user).receiver(true).save
          redirectTo("/circle/details/"+circle.id)
        }
        case _ => {
          redirectTo("index")
        }
      }
      redirectTo("/circle/index")
    }

      // oops... validation errors
      // display the errors and make sure our selected circle is still the same
    case x => error(x); selectedCircle(Full(circle))
  }
  
  /**
  * Confirm deleting a circle
  */
  // TODO fix delete - don't actually delete - just flag as deleted
  def confirmDelete(xhtml: NodeSeq): NodeSeq = {
    (for (circle <- selectedCircle.is) // find the user
     yield {
        def flagAsDeleted() {
          notice("Event "+circle.name+" deleted")
          circle.deleted(true)
          circle.save()
          redirectTo("/circle/deleted")
        }

        // bind the incoming XHTML to a "delete" button.
        // when the delete button is pressed, call the "deleteCircle"
        // function (which is a closure and bound the "circle" object
        // in the current content)
        bind("xmp", xhtml, "delete" -> submit("Delete", flagAsDeleted _, "class" -> "btn btn-danger"),
            "keep" -> submit("Keep", () => redirectTo("/circle/index"), "class" -> "btn btn-success"))

        // if there was no ID or the user couldn't be found,
        // display an error and redirect
      }) openOr {error("Circle not found"); redirectTo("/circle/index")}
  }}