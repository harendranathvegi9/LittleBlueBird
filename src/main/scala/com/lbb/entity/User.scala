package com.lbb.entity

import java.text.SimpleDateFormat
import java.util.Date
import scala.xml.Text
import org.joda.time.DateMidnight
import org.joda.time.Years
import net.liftweb.common.Box
import net.liftweb.common.Empty
import net.liftweb.common.Full
import net.liftweb.mapper._
import net.liftweb.util.FieldError
import scala.xml.NodeSeq
import scala.xml.Elem
import net.liftweb.http.S
import com.lbb.gui.MappedEmailExtended
import com.lbb.gui.MappedTextareaExtended
import com.lbb.gui.MappedStringExtended
import com.lbb.gui.MappedDateExtended
import net.liftweb.http.js.JsExp
import net.liftweb.http.JsonResponse
import net.liftweb.http.js.JE.JsArray
import net.liftweb.http.js.JE.Str
import net.liftweb.json.JsonAST.JField
import net.liftweb.json.JsonAST.JString
import net.liftweb.json.JsonAST.JArray
import net.liftweb.http.js.JE.JsAnd
import net.liftweb.json.Serialization


/**
 * An O-R mapped "User" class that includes first name, last name, password and we add a "Personal Essay" to it
 * Lesson:  Don't have to implement validate here - use the inherited validate which will call validate on all the fields
 */
// TODO store user preferences
class User extends LongKeyedMapper[User] {
  def getSingleton = User
  
  def primaryKeyField = id
  object id extends MappedLongIndex(this)
  
  override def validate:List[FieldError] = {
    (first, last) match {
      case(f, l) if(f.is.trim()=="" && l.is.trim()=="") => {
        val list = List(FieldError(first, Text("Enter a first or last name")))
        val ff = (list :: super.validate :: Nil).flatten
        ff
      }
      case _ => super.validate
    }
  }
  
  object first extends MappedStringExtended(this, 140) {
    override def displayName = "First Name"
      
    override def _toForm:Box[Elem] = {
      val sup = super._toForm
      println("User.first._toForm: " + sup)
      println("User.first._toForm: " + this.fieldId)
      sup
    }
  }
  
  object last extends MappedStringExtended(this, 140) {
    override def displayName = "Last Name"
  }  
  
  object profilepic extends MappedStringExtended(this, 1028) {
    override def displayName = "Profile Pic"
  }  
  
  def profilepicOrDefault:NodeSeq = {
    profilepic.is match {
      case s:String if(s!=null && !s.trim().equals("")) => <img src={profilepic.is}/>
      case _ => <img src="/images/noprofilepic.jpg"/>
    }
  }
  
  object email extends MappedEmailExtended(this, 140) {
    override def displayName = "Email"
  }  
  
  object username extends MappedStringExtended(this, 140) {
    override def displayName = "Username"
    
    // http://scala-tools.org/mvnsites/liftweb-2.4-M4/#net.liftweb.mapper.MappedString
    override def validations = valUnique(displayName+" already exists") _ :: super.validations
  
    override def validate:List[FieldError] = {
      this.is match {
        case s if(s.trim()=="") => {
          val list = List(FieldError(this, Text(displayName+" is required")))
          val ff = (list :: super.validate :: Nil).flatten
          ff
        }
        case _ => super.validate
      }
    }
  }
  
  // this was once a MappedPassword, but with angularjs talking over REST, there's no real point
  // Trying to use the db tables I have - not worry about migrating to some new version of tables.
  object password extends MappedStringExtended(this, 140) {
    override def displayName = "Password"
  }
  
  // https://github.com/lift/framework/blob/master/persistence/mapper/src/main/scala/net/liftweb/mapper/MappedDate.scala
  object dateOfBirth extends MappedDateExtended(this) {

    override def displayName = "Date of Birth"
      
    var err:List[FieldError] = Nil
    
    final val dateFormat = new SimpleDateFormat("MM/dd/yyyy")
    
    override def asHtml = is match {
      case null => Text("")
      case _ => Text(dateFormat.format(is))
    }
    
    override def format(d:Date) = d match {
      case null => ""
      case _ => dateFormat.format(d)
    }
    
    val Pat = """(\d){1,2}/(\d){1,2}/(\d){4}""".r
    
    override def parse(s:String) = s match {
      case Pat(m, d, y) => err = Nil; println("parse: case Pat(m, d, y): errors..."); err.foreach(println(_)); Full(dateFormat.parse(s))
      case "" => err = Nil; println("parse: case \"\": errors..."); err.foreach(println(_)); this.set(null); Empty
      case _ => err = FieldError(this, Text("Use MM/dd/yyyy format")) :: Nil; println("parse: case _ :  errors..."); err.foreach(println(_)); this.set(null); Empty
    }
    
    override def validate:List[FieldError] = err
  
  }
  
  object age extends MappedInt(this) {
    override def ignoreField_? = true
    override def is = {
      val dob = new DateMidnight(dateOfBirth.is)
      val now = new DateMidnight()
      val age = Years.yearsBetween(dob, now)
      age.getYears()
    }
  }
  
  val F = """(\w+)""".r
  val FL = """(\w+)\s+(\w+)""".r
  val FML = """(\w+)\s+([^ ]+)\s+(\w+)""".r
  
  def name(s:String) = {
    s match {
      case F(f) => { first(f); }
      case FL(f, l) => { first(f); last(l); }
      case FML(f, m, l) => { first(f); last(l); }
      case _ => 
    }
  }

  // define an additional field for a personal essay
  object bio extends MappedTextareaExtended(this, 2048) {
    override def textareaRows  = 10
    override def textareaCols = 50
    override def displayName = "Bio"
  }
  
  // query the circle_participant table to find out what circles you belong to
  def circles = CircleParticipant.findAll(By(CircleParticipant.person, this.id))
  
  // new&improved version of 'circles' above
  // return a List[Circle] not just the fkeys
  def circleList = circles.map(fk => fk.circle.obj.open_!)
  
  // For active circles
  def giftlist(viewer:User, circle:Circle) = {     		
    val sql = "select g.* from gift g join recipient r on r.gift = g.id where r.person = "+this.id   
    println(sql)    
    val gifts = Gift.findAllByInsecureSql(sql, IHaveValidatedThisSQL("me", "11/11/1111"))
    gifts filter {g => viewer.canSee(this, g, circle)}
  }
  
  /**
   * 'this' person is the viewer
   */
  def canSee(recipient:User, gift:Gift, circle:Circle) = (this, recipient, gift.sender.obj, gift, circle) match {
    // You can't see the recipient's gift in the context of this circle, because in this circle
    // the 'recipient' is only a 'giver'
    case(_, r, _, _, c) if(!r.isReceiver(c)) => false 
    
    // You CAN see the gift in this context of this circle because:
    // - the circle is still active
    // - the item hasn't been bought
    // - and you (the viewer) are the one who added this gift
    case(v, _, Empty, g, c) if(!c.isExpired && v.addedThis(g)) => {
      if(gift.description=="gift11") println("case(v, _, Empty, g, c) if(!c.isExpired && v.addedThis(g))")
      true
    }
    
    // You CAN see this gift IF
    // - the circle is still active
    // - the item hasn't been bought
    // - you are a recipient of the gift AND the gift was added by another recipient
    case(v, _, Empty, g, c) if(!c.isExpired && g.isFor(v)) => {
      if(gift.description=="gift11") println("case(v, _, Empty, g, c) if(!c.isExpired && v.isRecipient(g))")
      g.wasAddedByARecipient
    }
    
    
    // You CAN see this gift IF
    // - the circle is still active
    // - the item hasn't been bought
    // - you are not the one receiving this gift
    case(v, _, Empty, g, c) if(!c.isExpired && g.isForSomeoneElse(v)) => {
      if(gift.description=="gift11") println("case(v, _, Empty, g, c) if(!c.isExpired && !v.isRecipient(g))")
      true
    }
    
    // This item HAS been bought.  You will be able to see it if...
    // - the circle is still active
    // - you added this item to your own list
    // - and you have not yet received this item
    case(v, r, s:Full[User], g, c) if(!c.isExpired && v.addedThis(g) && !g.hasBeenReceived) => {
      if(gift.description=="gift11") println("case(v, r, s:Full[User], g, c) if(!c.isExpired && v.addedThis(g) && !g.hasBeenReceived)")
      true
    }
    
    // This item HAS been bought.  You will be able to see it if...
    // - the circle is still active
    // - and you have not yet received this item
    case(v, r, s:Full[User], g, c) if(!c.isExpired && g.isFor(v) && g.wasAddedByARecipient && !g.hasBeenReceived) => {
      if(gift.description=="gift11") println("case(v, r, s:Full[User], g, c) if(!c.isExpired && v.isRecipient(g) && !g.hasBeenReceived)")
      true
    }
    
    // This item HAS been bought, but you CANNOT see it if...
    // - the gift is for someone else
    // - the gift has not been received
    case(v, _, s:Full[User], g, _) if(g.isForSomeoneElse(v) && !g.hasBeenReceived) => false
    
    // This item HAS been bought.  You will be able to see it if...
    // - the circle is expired
    // - the gift was bought in the expired circle
    case(_, _, s:Full[User], g, c) if(c.isExpired && g.circle.obj.map(_.id.is).openOr(-1)==c.id.is) => {
      if(gift.description=="gift11") println("case(_, _, s:Full[User], g, c) if(c.isExpired && g.circle.obj.map(_.id.is).openOr(-1)==c.id.is)")
      true
    }
    
    case(_, _, _, g, c) if(c.isExpired && !g.wasBoughtInThisCircle(c)) => false
    
    // the gift has been received in another circle, so you cannot see this gift in THIS circle
    case(_, _, s:Full[User], g, c) if(g.hasBeenReceivedInAnotherCircle(c)) => false
    
    case _ => {println("should catch this case"); true}

  }
  
  def isReceiver(c:Circle) = CircleParticipant.find(By(CircleParticipant.circle, c.id), By(CircleParticipant.person, this.id)) match {
    case f:Full[CircleParticipant] if(f.open_!.receiver.is) => true
    case _ => false
  }
  
  def addedThis(g:Gift) = {
    g.addedBy.is==this.id.is
  }
  
  def buy(g:Gift) = {
    g.sender(this).save()
  }
  
  def findByName(f:String, l:String) = {
    User.findAll(Cmp(User.first, OprEnum.Like, Full("%"+f.toLowerCase+"%"), Empty, Full("LOWER")),
        Cmp(User.last, OprEnum.Like, Full("%"+l.toLowerCase+"%"), Empty, Full("LOWER")))
  }
  
  override def toForm(button: Box[String], f: User => Any): NodeSeq = {
    println("User.toForm")
    super.toForm(button, f)
  }
  
  def canEdit(g:Gift):Boolean = {
    (iadded(g) || (iamrecipient(g) && g.wasAddedByARecipient)) && !g.hasBeenReceived
  }
  
  def canDelete(g:Gift):Boolean = {
    canEdit(g)
  }
  
  def canBuy(g:Gift):Boolean = {
    !g.isBought && !iamrecipient(g)
  }
  
  def canReturn(g:Gift):Boolean = {
    ibought(g) && !g.hasBeenReceived
  }
  
  private def iadded(g:Gift):Boolean = {
    g.addedBy.obj match {
      case Full(adder) => adder.id.equals(this.id)
      case _ => false
    }
  }
  
  private def iamrecipient(g:Gift):Boolean = {
    g.isFor(this)
  }
  
  private def ibought(g:Gift):Boolean = g.sender.obj match {
    case Full(sender) => sender.id.equals(this.id)
    case _ => false
  }
  
  override def suplementalJs(ob: Box[KeyObfuscator]): List[(String, JsExp)] = {
    val jsons = circleList.map(_.asJs)
    val jsArr = JsArray(jsons)
    List(("fullname", JString(first+" "+last)), ("circles", jsArr))        
  }

}

/**
 * The singleton that has methods for accessing the database
 */
object User extends User with LongKeyedMetaMapper[User] {
  
  override def dbTableName = "users" // define the DB table name
  
  // define the order fields will appear in forms and output
  override def fieldOrder = List(id, first, last, email,
  username, password, dateOfBirth, profilepic, bio)
  
  // mapper won't let you query by password
  val queriableFields = List(User.first, User.last, User.username, User.email)
}